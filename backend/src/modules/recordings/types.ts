/**
 * Bolti Kitab — Recordings Module Domain Types
 *
 * Covers: recording_sessions and recordings (takes) tables.
 * See database/migrations/001_initial_phase1_schema.sql for authoritative schema.
 */

// ─── Literal unions mirroring CHECK constraints ───────────────────────────────

export type RecordingSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type RecordingStatus =
  | 'uploading'
  | 'submitted_for_review'
  | 'approved'
  | 'rejected';

export type SampleRate = 22050 | 44100 | 48000;
export type AudioChannels = 1 | 2;

// ─── Database row shapes (mirror column names exactly) ───────────────────────

export interface RecordingSessionRow {
  id: string;
  narrator_id: string;
  book_id: string;
  chapter_id: string;
  status: RecordingSessionStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RecordingRow {
  id: string;
  session_id: string;
  chapter_id: string;
  take_number: number;
  raw_audio_key: string;
  duration_ms: number;
  file_size_bytes: string; // BIGINT comes back as string from pg
  sample_rate_hz: number;
  channels: number;
  status: RecordingStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Safe API projections (never expose raw_audio_key to public endpoints) ───

/** Full session detail — returned to narrator and editors/admins. */
export interface SafeSession {
  id: string;
  narrator_id: string;
  book_id: string;
  chapter_id: string;
  status: RecordingSessionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Take detail returned to narrator (their own takes) and review queue items. */
export interface SafeTake {
  id: string;
  session_id: string;
  chapter_id: string;
  take_number: number;
  duration_ms: number;
  file_size_bytes: number;
  sample_rate_hz: number;
  channels: number;
  status: RecordingStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // raw_audio_key is intentionally excluded from all client-facing projections
}

/** Upload token response — includes recording_id so narrator can call confirm. */
export interface UploadTokenResponse {
  recording_id: string;
  blob_key: string;       // Informational only — the server owns the key
  upload_url: string;
  expires_at: string;
}

// ─── Service input types ──────────────────────────────────────────────────────

export interface CreateSessionInput {
  narrator_id: string;
  book_id: string;
  chapter_id: string;
  notes?: string | undefined;
}

export interface ConfirmTakeInput {
  duration_ms: number;
  file_size_bytes: number;
  sample_rate_hz: SampleRate;
  channels: AudioChannels;
}

export interface RejectTakeInput {
  review_notes: string;
}
