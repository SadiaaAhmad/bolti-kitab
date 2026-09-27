/**
 * Bolti Kitab — Playback Repository
 *
 * Parameterized SQL queries for playback authorization, chapter streams,
 * entitlement verification, and listening progress synchronization.
 */

import { pool } from '../../db/pool.js';
import type {
  ListeningProgressDto,
  PlaybackChapterInfo,
  UpdateProgressInput,
} from './types.js';

export interface BookPlaybackDbRow {
  id: string;
  title: string;
  title_urdu: string;
  status: string;
}

export interface ChapterPlaybackDbRow {
  id: string;
  book_id: string;
  chapter_num: number;
  title: string;
  title_urdu: string | null;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  audio_object_key: string | null;
  is_preview_free: boolean;
  status: string;
}

export async function findBookForPlayback(bookId: string): Promise<BookPlaybackDbRow | null> {
  const sql = `SELECT id, title, title_urdu, status FROM books WHERE id = $1 LIMIT 1`;
  const res = await pool.query<BookPlaybackDbRow>(sql, [bookId]);
  return res.rows[0] ?? null;
}

export async function findChaptersForPlayback(bookId: string): Promise<PlaybackChapterInfo[]> {
  const sql = `
    SELECT id, chapter_num, title, title_urdu, start_ms, duration_ms, is_preview_free,
           (status = 'approved') AS is_approved
      FROM chapters
     WHERE book_id = $1
  ORDER BY chapter_num ASC
  `;
  const res = await pool.query<{
    id: string;
    chapter_num: number;
    title: string;
    title_urdu: string | null;
    start_ms: number;
    duration_ms: number;
    is_preview_free: boolean;
    is_approved: boolean;
  }>(sql, [bookId]);
  return res.rows;
}

export async function findChapterForPlayback(
  bookId: string,
  chapterId: string,
): Promise<ChapterPlaybackDbRow | null> {
  const sql = `
    SELECT id, book_id, chapter_num, title, title_urdu, start_ms, end_ms,
           duration_ms, audio_object_key, is_preview_free, status
      FROM chapters
     WHERE book_id = $1 AND id = $2
     LIMIT 1
  `;
  const res = await pool.query<ChapterPlaybackDbRow>(sql, [bookId, chapterId]);
  return res.rows[0] ?? null;
}

export async function checkUserEntitlement(userId: string, bookId: string): Promise<boolean> {
  const sql = `
    SELECT id
      FROM entitlements
     WHERE user_id = $1
       AND book_id = $2
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1
  `;
  const res = await pool.query<{ id: string }>(sql, [userId, bookId]);
  return res.rows.length > 0;
}

export async function findListeningProgress(
  userId: string,
  bookId: string,
): Promise<ListeningProgressDto | null> {
  const sql = `
    SELECT user_id, book_id, chapter_id, position_ms, update_seq, is_completed, updated_at
      FROM listening_progress
     WHERE user_id = $1 AND book_id = $2
     LIMIT 1
  `;
  const res = await pool.query<{
    user_id: string;
    book_id: string;
    chapter_id: string;
    position_ms: number;
    update_seq: string;
    is_completed: boolean;
    updated_at: Date;
  }>(sql, [userId, bookId]);

  const row = res.rows[0];
  if (!row) return null;

  return {
    user_id: row.user_id,
    book_id: row.book_id,
    chapter_id: row.chapter_id,
    position_ms: row.position_ms,
    update_seq: parseInt(row.update_seq, 10),
    is_completed: row.is_completed,
    updated_at: row.updated_at.toISOString(),
  };
}

export async function upsertListeningProgress(
  userId: string,
  bookId: string,
  input: UpdateProgressInput,
): Promise<ListeningProgressDto> {
  const seq = input.update_seq ?? 1;
  const isCompleted = input.is_completed ?? false;

  const sql = `
    INSERT INTO listening_progress (user_id, book_id, chapter_id, position_ms, update_seq, is_completed, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
      chapter_id   = EXCLUDED.chapter_id,
      position_ms  = EXCLUDED.position_ms,
      update_seq   = EXCLUDED.update_seq,
      is_completed = EXCLUDED.is_completed,
      updated_at   = CURRENT_TIMESTAMP
    WHERE listening_progress.update_seq <= EXCLUDED.update_seq
    RETURNING user_id, book_id, chapter_id, position_ms, update_seq, is_completed, updated_at
  `;

  const res = await pool.query<{
    user_id: string;
    book_id: string;
    chapter_id: string;
    position_ms: number;
    update_seq: string;
    is_completed: boolean;
    updated_at: Date;
  }>(sql, [userId, bookId, input.chapter_id, input.position_ms, seq, isCompleted]);

  const row = res.rows[0];
  if (!row) {
    // Stale update rejected due to optimistic concurrency check
    const current = await findListeningProgress(userId, bookId);
    if (!current) throw new Error('Failed to synchronize listening progress.');
    return current;
  }

  return {
    user_id: row.user_id,
    book_id: row.book_id,
    chapter_id: row.chapter_id,
    position_ms: row.position_ms,
    update_seq: parseInt(row.update_seq, 10),
    is_completed: row.is_completed,
    updated_at: row.updated_at.toISOString(),
  };
}
