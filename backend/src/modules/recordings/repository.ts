/**
 * Bolti Kitab -- Recordings Repository
 *
 * Parameterized SQL for recording_sessions and recordings tables.
 * All queries use the shared pool -- approval runs in an explicit transaction.
 */

import { pool } from '../../db/pool.js';
import type {
  RecordingSessionRow,
  RecordingRow,
  CreateSessionInput,
  ConfirmTakeInput,
  RecordingSessionStatus,
} from './types.js';

// --- Safe column projections ---
// raw_audio_key IS fetched internally for the approval transaction and
// objectExists check, but is never included in response serialization.

const SESSION_COLS = 'id, narrator_id, book_id, chapter_id, status, notes, created_at, updated_at';

const TAKE_COLS = [
  'id', 'session_id', 'chapter_id', 'take_number', 'raw_audio_key',
  'duration_ms', 'file_size_bytes', 'sample_rate_hz', 'channels',
  'status', 'review_notes', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
].join(', ');

// --- Recording Sessions ---

export async function insertSession(data: CreateSessionInput): Promise<RecordingSessionRow> {
  const sql = `
    INSERT INTO recording_sessions (narrator_id, book_id, chapter_id, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING ${SESSION_COLS}
  `;
  const result = await pool.query<RecordingSessionRow>(sql, [
    data.narrator_id, data.book_id, data.chapter_id, data.notes ?? null,
  ]);
  const row = result.rows[0];
  if (!row) throw new Error('Session insertion failed unexpectedly.');
  return row;
}

export async function findSessionById(sessionId: string): Promise<RecordingSessionRow | null> {
  const sql = `SELECT ${SESSION_COLS} FROM recording_sessions WHERE id = $1 LIMIT 1`;
  const result = await pool.query<RecordingSessionRow>(sql, [sessionId]);
  return result.rows[0] ?? null;
}

export interface ListSessionsOptions {
  narratorId?: string | undefined;
  status?: RecordingSessionStatus | undefined;
}

export async function findSessions(options: ListSessionsOptions): Promise<RecordingSessionRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  if (options.narratorId !== undefined) {
    conditions.push(`narrator_id = $${p++}`);
    values.push(options.narratorId);
  }
  if (options.status !== undefined) {
    conditions.push(`status = $${p++}`);
    values.push(options.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT ${SESSION_COLS} FROM recording_sessions ${where} ORDER BY created_at DESC`;
  const result = await pool.query<RecordingSessionRow>(sql, values);
  return result.rows;
}

// --- Recordings (Takes) ---

export async function countTakesInSession(sessionId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM recordings WHERE session_id = $1',
    [sessionId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function insertUploadingTake(
  sessionId: string,
  chapterId: string,
  takeNumber: number,
  rawAudioKey: string,
): Promise<RecordingRow> {
  const sql = `
    INSERT INTO recordings (session_id, chapter_id, take_number, raw_audio_key,
                            duration_ms, file_size_bytes, sample_rate_hz, channels, status)
    VALUES ($1, $2, $3, $4, 0, 0, 44100, 2, 'uploading')
    RETURNING ${TAKE_COLS}
  `;
  const result = await pool.query<RecordingRow>(sql, [sessionId, chapterId, takeNumber, rawAudioKey]);
  const row = result.rows[0];
  if (!row) throw new Error('Recording insertion failed unexpectedly.');
  return row;
}

export async function findRecordingById(recordingId: string): Promise<RecordingRow | null> {
  const sql = `SELECT ${TAKE_COLS} FROM recordings WHERE id = $1 LIMIT 1`;
  const result = await pool.query<RecordingRow>(sql, [recordingId]);
  return result.rows[0] ?? null;
}

export async function confirmTake(
  recordingId: string,
  data: ConfirmTakeInput,
): Promise<RecordingRow | null> {
  const sql = `
    UPDATE recordings
       SET duration_ms     = $1,
           file_size_bytes = $2,
           sample_rate_hz  = $3,
           channels        = $4,
           status          = 'submitted_for_review',
           updated_at      = CURRENT_TIMESTAMP
     WHERE id = $5 AND status = 'uploading'
     RETURNING ${TAKE_COLS}
  `;
  const result = await pool.query<RecordingRow>(sql, [
    data.duration_ms, data.file_size_bytes, data.sample_rate_hz, data.channels, recordingId,
  ]);
  return result.rows[0] ?? null;
}

// --- Review Queue ---

export interface ReviewQueueResult {
  rows: RecordingRow[];
  total: number;
}

export async function findReviewQueue(page: number, limit: number): Promise<ReviewQueueResult> {
  const offset = (page - 1) * limit;

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM recordings WHERE status = 'submitted_for_review'`,
  );
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

  const sql = `
    SELECT ${TAKE_COLS}
      FROM recordings
     WHERE status = 'submitted_for_review'
     ORDER BY created_at ASC
     LIMIT $1 OFFSET $2
  `;
  const result = await pool.query<RecordingRow>(sql, [limit, offset]);
  return { rows: result.rows, total };
}

// --- Reject ---

export async function rejectTake(
  recordingId: string,
  reviewerId: string,
  reviewNotes: string,
): Promise<RecordingRow | null> {
  const sql = `
    UPDATE recordings
       SET status       = 'rejected',
           review_notes = $1,
           reviewed_by  = $2,
           reviewed_at  = CURRENT_TIMESTAMP,
           updated_at   = CURRENT_TIMESTAMP
     WHERE id = $3 AND status = 'submitted_for_review'
     RETURNING ${TAKE_COLS}
  `;
  const result = await pool.query<RecordingRow>(sql, [reviewNotes, reviewerId, recordingId]);
  return result.rows[0] ?? null;
}

// --- Approve (3-table transaction) ---

export interface ApprovalResult {
  recording: RecordingRow;
}

export async function approveTake(
  recordingId: string,
  reviewerId: string,
): Promise<ApprovalResult | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load recording + session, verify chain integrity
    const chainSql = `
      SELECT r.id            AS recording_id,
             r.status        AS recording_status,
             r.session_id,
             r.chapter_id    AS recording_chapter_id,
             r.raw_audio_key,
             rs.narrator_id,
             rs.book_id,
             rs.chapter_id   AS session_chapter_id
        FROM recordings r
        JOIN recording_sessions rs ON rs.id = r.session_id
       WHERE r.id = $1
       FOR UPDATE
    `;
    const chainResult = await client.query<{
      recording_id: string;
      recording_status: string;
      session_id: string;
      recording_chapter_id: string;
      raw_audio_key: string;
      narrator_id: string;
      book_id: string;
      session_chapter_id: string;
    }>(chainSql, [recordingId]);

    const chain = chainResult.rows[0];
    if (!chain) {
      await client.query('ROLLBACK');
      return null;
    }

    if (chain.recording_chapter_id !== chain.session_chapter_id) {
      await client.query('ROLLBACK');
      throw new Error('Data integrity violation: recording chapter_id does not match session chapter_id.');
    }

    if (chain.recording_status !== 'submitted_for_review') {
      await client.query('ROLLBACK');
      return null;
    }

    // 1. Approve the recording
    const approveRecordingSql = `
      UPDATE recordings
         SET status      = 'approved',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at  = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'submitted_for_review'
       RETURNING ${TAKE_COLS}
    `;
    const recordingResult = await client.query<RecordingRow>(
      approveRecordingSql, [reviewerId, recordingId],
    );
    const approvedRecording = recordingResult.rows[0];
    if (!approvedRecording) {
      await client.query('ROLLBACK');
      return null;
    }

    // 2. Associate audio with chapter
    await client.query(
      `UPDATE chapters
         SET audio_object_key = $1,
             status           = 'approved',
             updated_at       = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [chain.raw_audio_key, chain.recording_chapter_id],
    );

    // 3. Mark session completed
    await client.query(
      `UPDATE recording_sessions
         SET status     = 'completed',
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [chain.session_id],
    );

    await client.query('COMMIT');
    return { recording: approvedRecording };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
