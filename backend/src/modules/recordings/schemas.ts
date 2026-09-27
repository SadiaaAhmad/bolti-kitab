/**
 * Bolti Kitab — Recordings Module Fastify JSON Schemas
 *
 * All request body schemas are strict (no additional properties).
 * Response schemas use 'type: object' with explicit properties.
 *
 * IMPORTANT: The confirm-take body does NOT include a blob_key field.
 * The server retrieves the blob key from the database using the recording_id
 * in the path parameter. Clients never supply storage paths.
 */

// ─── Shared property definitions ─────────────────────────────────────────────

const uuidParam = { type: 'string', format: 'uuid' } as const;

const safeSessionProperties = {
  id:          { type: 'string' },
  narrator_id: { type: 'string' },
  book_id:     { type: 'string' },
  chapter_id:  { type: 'string' },
  status:      { type: 'string', enum: ['in_progress', 'completed', 'abandoned'] },
  notes:       { type: ['string', 'null'] },
  created_at:  { type: 'string' },
  updated_at:  { type: 'string' },
} as const;

const safeTakeProperties = {
  id:              { type: 'string' },
  session_id:      { type: 'string' },
  chapter_id:      { type: 'string' },
  take_number:     { type: 'integer' },
  duration_ms:     { type: 'integer' },
  file_size_bytes: { type: 'integer' },
  sample_rate_hz:  { type: 'integer' },
  channels:        { type: 'integer' },
  status:          { type: 'string', enum: ['uploading', 'submitted_for_review', 'approved', 'rejected'] },
  review_notes:    { type: ['string', 'null'] },
  reviewed_by:     { type: ['string', 'null'] },
  reviewed_at:     { type: ['string', 'null'] },
  created_at:      { type: 'string' },
  updated_at:      { type: 'string' },
} as const;

// ─── POST /recording-sessions ─────────────────────────────────────────────────

export const createSessionBodySchema = {
  type: 'object',
  required: ['book_id', 'chapter_id'],
  additionalProperties: false,
  properties: {
    book_id:    uuidParam,
    chapter_id: uuidParam,
    notes:      { type: 'string', maxLength: 2000 },
  },
} as const;

export const sessionResponseSchema = {
  type: 'object',
  properties: safeSessionProperties,
} as const;

// ─── GET /recording-sessions (list) ──────────────────────────────────────────

export const listSessionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['in_progress', 'completed', 'abandoned'] },
  },
} as const;

// ─── POST /recording-sessions/:sessionId/upload-token ────────────────────────
// No request body — session ID comes from the path.

export const uploadTokenResponseSchema = {
  type: 'object',
  properties: {
    recording_id: { type: 'string' },
    blob_key:     { type: 'string' },
    upload_url:   { type: 'string' },
    expires_at:   { type: 'string' },
  },
} as const;

// ─── POST /recordings/:recordingId/confirm ────────────────────────────────────
// Client declares audio metadata only. blob_key is NOT accepted here.

export const confirmTakeBodySchema = {
  type: 'object',
  required: ['duration_ms', 'file_size_bytes', 'sample_rate_hz', 'channels'],
  additionalProperties: false,
  properties: {
    duration_ms:     { type: 'integer', minimum: 1 },
    file_size_bytes: { type: 'integer', minimum: 1 },
    sample_rate_hz:  { type: 'integer', enum: [22050, 44100, 48000] },
    channels:        { type: 'integer', enum: [1, 2] },
  },
} as const;

export const takeResponseSchema = {
  type: 'object',
  properties: safeTakeProperties,
} as const;

// ─── GET /recordings/review-queue ────────────────────────────────────────────

export const reviewQueueQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page:  { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const reviewQueueResponseSchema = {
  type: 'object',
  properties: {
    data:  { type: 'array', items: { type: 'object', properties: safeTakeProperties } },
    total: { type: 'integer' },
    page:  { type: 'integer' },
    limit: { type: 'integer' },
  },
} as const;

// ─── PATCH /recordings/:recordingId/reject ───────────────────────────────────

export const rejectTakeBodySchema = {
  type: 'object',
  required: ['review_notes'],
  additionalProperties: false,
  properties: {
    review_notes: { type: 'string', minLength: 1, maxLength: 2000 },
  },
} as const;

// ─── Session params schema ───────────────────────────────────────────────────

export const sessionParamsSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: uuidParam,
  },
} as const;

export const recordingParamsSchema = {
  type: 'object',
  required: ['recordingId'],
  properties: {
    recordingId: uuidParam,
  },
} as const;
