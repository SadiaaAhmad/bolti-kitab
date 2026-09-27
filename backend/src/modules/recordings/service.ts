/**
 * Bolti Kitab -- Recordings Service
 *
 * Business logic layer. Coordinates repository calls, storage provider,
 * ownership checks, and state transition enforcement.
 *
 * KEY SECURITY RULES:
 *   - blob keys are generated server-side; clients never supply storage paths
 *   - objectExists() is called before confirming any take
 *   - approve/reject only operate on submitted_for_review
 *   - narrators can only operate on their own sessions/takes
 */

import { randomUUID } from 'node:crypto';
import { config } from '../../config/env.js';
import { getStorageProvider } from '../../storage/index.js';
import type { UploadAuthorization } from '../../storage/types.js';
import * as repo from './repository.js';
import type {
  RecordingSessionRow,
  RecordingRow,
  SafeSession,
  SafeTake,
  UploadTokenResponse,
  CreateSessionInput,
  ConfirmTakeInput,
  RejectTakeInput,
  RecordingSessionStatus,
} from './types.js';
import { findChapterById } from '../catalog/repository.js';

// --- Projection helpers ---

function toSafeSession(row: RecordingSessionRow): SafeSession {
  return {
    id:          row.id,
    narrator_id: row.narrator_id,
    book_id:     row.book_id,
    chapter_id:  row.chapter_id,
    status:      row.status,
    notes:       row.notes,
    created_at:  row.created_at.toISOString(),
    updated_at:  row.updated_at.toISOString(),
  };
}

function toSafeTake(row: RecordingRow): SafeTake {
  return {
    id:              row.id,
    session_id:      row.session_id,
    chapter_id:      row.chapter_id,
    take_number:     row.take_number,
    duration_ms:     row.duration_ms,
    file_size_bytes: parseInt(String(row.file_size_bytes), 10),
    sample_rate_hz:  row.sample_rate_hz,
    channels:        row.channels,
    status:          row.status,
    review_notes:    row.review_notes,
    reviewed_by:     row.reviewed_by,
    reviewed_at:     row.reviewed_at ? row.reviewed_at.toISOString() : null,
    created_at:      row.created_at.toISOString(),
    updated_at:      row.updated_at.toISOString(),
    // raw_audio_key is intentionally excluded
  };
}

// --- Session operations ---

export interface CreateSessionOptions {
  narratorId: string;
  bookId: string;
  chapterId: string;
  notes?: string | undefined;
}

export async function createSession(opts: CreateSessionOptions): Promise<SafeSession> {
  const chapter = await findChapterById(opts.bookId, opts.chapterId);
  if (!chapter) {
    const err = new Error('Chapter not found for this book.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const input: CreateSessionInput = {
    narrator_id: opts.narratorId,
    book_id:     opts.bookId,
    chapter_id:  opts.chapterId,
    notes:       opts.notes,
  };
  const row = await repo.insertSession(input);
  return toSafeSession(row);
}

export async function getSession(
  sessionId: string,
  requestingUserId: string,
  requestingRole: string,
): Promise<SafeSession> {
  const row = await repo.findSessionById(sessionId);
  if (!row) {
    const err = new Error('Recording session not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  if (requestingRole === 'narrator' && row.narrator_id !== requestingUserId) {
    const err = new Error('You do not have permission to access this session.') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  return toSafeSession(row);
}

export async function listSessions(
  requestingUserId: string,
  requestingRole: string,
  status?: RecordingSessionStatus | undefined,
): Promise<SafeSession[]> {
  const narratorId = requestingRole === 'narrator' ? requestingUserId : undefined;
  const rows = await repo.findSessions({ narratorId, status });
  return rows.map(toSafeSession);
}

// --- Upload token ---

export async function generateUploadToken(
  sessionId: string,
  requestingUserId: string,
  requestingRole: string,
): Promise<UploadTokenResponse> {
  const session = await repo.findSessionById(sessionId);
  if (!session) {
    const err = new Error('Recording session not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  if (requestingRole === 'narrator' && session.narrator_id !== requestingUserId) {
    const err = new Error('You do not have permission to upload for this session.') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  if (session.status !== 'in_progress') {
    const err = new Error(
      `Cannot upload to a session with status '${session.status}'.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const existingCount = await repo.countTakesInSession(sessionId);
  const takeNumber = existingCount + 1;

  // Generate server-side blob key -- never accepted from the client.
  // Standardized on MP3 (audio/mpeg) container to match real audio encoding.
  const blobKey = `recordings/${sessionId}/${randomUUID()}.mp3`;

  // Insert the take row in 'uploading' status before issuing the URL
  const recordingRow = await repo.insertUploadingTake(
    sessionId, session.chapter_id, takeNumber, blobKey,
  );

  const ttl = config.storage.uploadTtlSeconds;
  const storage = getStorageProvider();
  const auth: UploadAuthorization = await storage.generateUploadUrl(blobKey, ttl);

  return {
    recording_id: recordingRow.id,
    blob_key:     auth.blob_key,
    upload_url:   auth.upload_url,
    expires_at:   auth.expires_at,
  };
}

// --- Confirm take ---

export async function confirmTake(
  recordingId: string,
  requestingUserId: string,
  requestingRole: string,
  input: ConfirmTakeInput,
): Promise<SafeTake> {
  const recording = await repo.findRecordingById(recordingId);
  if (!recording) {
    const err = new Error('Recording not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  if (requestingRole === 'narrator') {
    const session = await repo.findSessionById(recording.session_id);
    if (!session || session.narrator_id !== requestingUserId) {
      const err = new Error('You do not have permission to confirm this recording.') as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }
  }

  if (recording.status !== 'uploading') {
    const err = new Error(
      `Recording cannot be confirmed: current status is '${recording.status}'.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const storage = getStorageProvider();
  const exists = await storage.objectExists(recording.raw_audio_key);
  if (!exists) {
    const err = new Error(
      'Upload not found in storage. Ensure the file was uploaded to the provided URL before confirming.',
    ) as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }

  const updated = await repo.confirmTake(recordingId, input);
  if (!updated) {
    const err = new Error(
      'Recording status changed concurrently. Please refresh and try again.',
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  return toSafeTake(updated);
}

// --- Review queue ---

export interface ReviewQueuePage {
  data: SafeTake[];
  total: number;
  page: number;
  limit: number;
}

export async function getReviewQueue(page: number, limit: number): Promise<ReviewQueuePage> {
  const { rows, total } = await repo.findReviewQueue(page, limit);
  return { data: rows.map(toSafeTake), total, page, limit };
}

// --- Reject ---

export async function rejectTake(
  recordingId: string,
  reviewerId: string,
  input: RejectTakeInput,
): Promise<SafeTake> {
  const recording = await repo.findRecordingById(recordingId);
  if (!recording) {
    const err = new Error('Recording not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (recording.status !== 'submitted_for_review') {
    const err = new Error(
      `Cannot reject recording with status '${recording.status}'. Only 'submitted_for_review' takes may be rejected.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const updated = await repo.rejectTake(recordingId, reviewerId, input.review_notes);
  if (!updated) {
    const err = new Error(
      'Recording status changed concurrently. Please refresh and try again.',
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }
  return toSafeTake(updated);
}

// --- Approve ---

export async function approveTake(recordingId: string, reviewerId: string): Promise<SafeTake> {
  const recording = await repo.findRecordingById(recordingId);
  if (!recording) {
    const err = new Error('Recording not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (recording.status !== 'submitted_for_review') {
    const err = new Error(
      `Cannot approve recording with status '${recording.status}'. Only 'submitted_for_review' takes may be approved.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const result = await repo.approveTake(recordingId, reviewerId);
  if (!result) {
    const err = new Error(
      'Recording status changed concurrently. Please refresh and try again.',
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }
  return toSafeTake(result.recording);
}
