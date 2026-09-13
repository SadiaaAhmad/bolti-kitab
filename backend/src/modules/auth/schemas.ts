/**
 * Bolti Kitab — Auth Route Validation Schemas
 *
 * JSON Schema definitions for Fastify route body validation and response shaping.
 * Response schemas explicitly omit password_hash — Fastify will strip any field
 * not listed in the response schema at serialization time.
 */

// ─── Request Bodies ───────────────────────────────────────────────────────────

export const registerBodySchema = {
  type: 'object',
  required: ['email', 'password', 'full_name'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
    },
    full_name: {
      type: 'string',
      minLength: 2,
      maxLength: 128,
    },
  },
} as const;

export const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
  },
} as const;

// ─── Safe User Response (password_hash explicitly excluded) ──────────────────
const safeUserProperties = {
  id: { type: 'string', format: 'uuid' },
  email: { type: 'string' },
  full_name: { type: 'string' },
  role: { type: 'string', enum: ['listener', 'narrator', 'editor', 'admin'] },
  status: { type: 'string', enum: ['active', 'suspended', 'pending_verification'] },
  created_at: { type: 'string' },
  updated_at: { type: 'string' },
} as const;

// ─── Route Schemas ────────────────────────────────────────────────────────────
export const registerRouteSchema = {
  body: registerBodySchema,
  response: {
    201: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: safeUserProperties,
        },
      },
    },
  },
};

export const loginRouteSchema = {
  body: loginBodySchema,
  response: {
    200: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        expires_in: { type: 'string' },
        user: {
          type: 'object',
          properties: safeUserProperties,
        },
      },
    },
  },
};

export const meRouteSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: safeUserProperties,
        },
      },
    },
  },
};
