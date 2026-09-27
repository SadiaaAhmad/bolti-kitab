/**
 * Bolti Kitab — Playback Module Fastify JSON Schemas
 */

const uuidParam = { type: 'string', format: 'uuid' } as const;

export const bookParamsSchema = {
  type: 'object',
  required: ['bookId'],
  properties: {
    bookId: uuidParam,
  },
} as const;

export const chapterParamsSchema = {
  type: 'object',
  required: ['bookId', 'chapterId'],
  properties: {
    bookId: uuidParam,
    chapterId: uuidParam,
  },
} as const;

export const playbackOverviewResponseSchema = {
  type: 'object',
  properties: {
    book_id:     { type: 'string' },
    title:       { type: 'string' },
    title_urdu:  { type: 'string' },
    is_entitled: { type: 'boolean' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:              { type: 'string' },
          chapter_num:     { type: 'integer' },
          title:           { type: 'string' },
          title_urdu:      { type: ['string', 'null'] },
          start_ms:        { type: 'integer' },
          duration_ms:     { type: 'integer' },
          is_preview_free: { type: 'boolean' },
          is_approved:     { type: 'boolean' },
        },
      },
    },
    progress: {
      type: ['object', 'null'],
      properties: {
        user_id:      { type: 'string' },
        book_id:      { type: 'string' },
        chapter_id:   { type: 'string' },
        position_ms:  { type: 'integer' },
        update_seq:   { type: 'integer' },
        is_completed: { type: 'boolean' },
        updated_at:   { type: 'string' },
      },
    },
  },
} as const;

export const playbackTokenResponseSchema = {
  type: 'object',
  properties: {
    book_id:      { type: 'string' },
    chapter_id:   { type: 'string' },
    chapter_num:  { type: 'integer' },
    title:        { type: 'string' },
    title_urdu:   { type: ['string', 'null'] },
    start_ms:     { type: 'integer' },
    duration_ms:  { type: 'integer' },
    playback_url: { type: 'string' },
    expires_at:   { type: 'string' },
    format:       { type: 'string' },
  },
} as const;

export const updateProgressBodySchema = {
  type: 'object',
  required: ['chapter_id', 'position_ms'],
  additionalProperties: false,
  properties: {
    chapter_id:   uuidParam,
    position_ms:  { type: 'integer', minimum: 0 },
    update_seq:   { type: 'integer', minimum: 1 },
    is_completed: { type: 'boolean' },
  },
} as const;

export const progressResponseSchema = {
  type: 'object',
  properties: {
    user_id:      { type: 'string' },
    book_id:      { type: 'string' },
    chapter_id:   { type: 'string' },
    position_ms:  { type: 'integer' },
    update_seq:   { type: 'integer' },
    is_completed: { type: 'boolean' },
    updated_at:   { type: 'string' },
  },
} as const;
