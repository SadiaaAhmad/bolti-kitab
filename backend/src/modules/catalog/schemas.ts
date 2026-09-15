/**
 * Bolti Kitab — Catalog Route JSON Schemas
 *
 * Fastify validation schemas for books and chapters endpoints.
 */

import type { FastifySchema } from 'fastify';

// ─── UUID format helper ───────────────────────────────────────────────────────
const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

// ─── GET /api/v1/books ────────────────────────────────────────────────────────
export const listBooksSchema: FastifySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: {
        anyOf: [
          { type: 'integer', minimum: 1 },
          { type: 'string', pattern: '^[1-9][0-9]*$' },
        ],
        default: 1,
      },
      limit: {
        anyOf: [
          { type: 'integer', minimum: 1, maximum: 100 },
          { type: 'string', pattern: '^[1-9][0-9]*$' },
        ],
        default: 20,
      },
      language: { type: 'string', enum: ['ur', 'en', 'pa', 'sd'] },
      status: {
        type: 'string',
        enum: ['draft', 'in_recording', 'in_review', 'active', 'archived'],
      },
      search: { type: 'string', minLength: 1, maxLength: 100 },
    },
  },
};

// ─── GET /api/v1/books/:id ────────────────────────────────────────────────────
export const getBookSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: UUID_REGEX },
    },
  },
};

// ─── GET /api/v1/books/:id/chapters ───────────────────────────────────────────
export const getChaptersSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: UUID_REGEX },
    },
  },
};

// ─── POST /api/v1/books ───────────────────────────────────────────────────────
export const createBookSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['title', 'title_urdu', 'author', 'narrator_name'],
    additionalProperties: false,
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      title_urdu: { type: 'string', minLength: 1, maxLength: 255 },
      author: { type: 'string', minLength: 1, maxLength: 128 },
      narrator_name: { type: 'string', minLength: 1, maxLength: 128 },
      synopsis: { type: ['string', 'null'] },
      language: { type: 'string', enum: ['ur', 'en', 'pa', 'sd'], default: 'ur' },
      duration_seconds: { type: 'integer', minimum: 0, default: 0 },
      price_cents: { type: 'integer', minimum: 0, default: 0 },
      currency: { type: 'string', minLength: 1, maxLength: 8, default: 'PKR' },
      cover_object_key: { type: ['string', 'null'], maxLength: 512 },
      status: {
        type: 'string',
        enum: ['draft', 'in_recording', 'in_review', 'active', 'archived'],
        default: 'draft',
      },
      published_at: { type: ['string', 'null'] },
    },
  },
};

// ─── PATCH /api/v1/books/:id ──────────────────────────────────────────────────
export const updateBookSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: UUID_REGEX },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      title_urdu: { type: 'string', minLength: 1, maxLength: 255 },
      author: { type: 'string', minLength: 1, maxLength: 128 },
      narrator_name: { type: 'string', minLength: 1, maxLength: 128 },
      synopsis: { type: ['string', 'null'] },
      language: { type: 'string', enum: ['ur', 'en', 'pa', 'sd'] },
      duration_seconds: { type: 'integer', minimum: 0 },
      price_cents: { type: 'integer', minimum: 0 },
      currency: { type: 'string', minLength: 1, maxLength: 8 },
      cover_object_key: { type: ['string', 'null'], maxLength: 512 },
      status: {
        type: 'string',
        enum: ['draft', 'in_recording', 'in_review', 'active', 'archived'],
      },
      published_at: { type: ['string', 'null'] },
    },
  },
};

// ─── POST /api/v1/books/:id/chapters ──────────────────────────────────────────
export const createChapterSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: UUID_REGEX },
    },
  },
  body: {
    type: 'object',
    required: ['chapter_num', 'title'],
    additionalProperties: false,
    properties: {
      chapter_num: { type: 'integer', minimum: 1 },
      title: { type: 'string', minLength: 1, maxLength: 255 },
      title_urdu: { type: ['string', 'null'], maxLength: 255 },
      start_ms: { type: 'integer', minimum: 0, default: 0 },
      end_ms: { type: 'integer', minimum: 0, default: 0 },
      duration_ms: { type: 'integer', minimum: 0 },
      is_preview_free: { type: 'boolean', default: false },
      status: {
        type: 'string',
        enum: ['pending', 'recorded', 'approved', 'rejected'],
        default: 'pending',
      },
    },
  },
};

// ─── PATCH /api/v1/books/:id/chapters/:chapterId ──────────────────────────────
export const updateChapterSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id', 'chapterId'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: UUID_REGEX },
      chapterId: { type: 'string', pattern: UUID_REGEX },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      chapter_num: { type: 'integer', minimum: 1 },
      title: { type: 'string', minLength: 1, maxLength: 255 },
      title_urdu: { type: ['string', 'null'], maxLength: 255 },
      start_ms: { type: 'integer', minimum: 0 },
      end_ms: { type: 'integer', minimum: 0 },
      duration_ms: { type: 'integer', minimum: 0 },
      is_preview_free: { type: 'boolean' },
      status: {
        type: 'string',
        enum: ['pending', 'recorded', 'approved', 'rejected'],
      },
    },
  },
};
