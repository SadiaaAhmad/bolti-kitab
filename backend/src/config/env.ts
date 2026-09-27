/**
 * Bolti Kitab — Environment Configuration
 *
 * Loads and validates all environment variables from .env at startup.
 * Throws a descriptive error if any required variable is missing.
 * All modules must import config from this file — never from process.env directly.
 */

import 'dotenv/config.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

function requireIntEnv(name: string): number {
  const raw = requireEnv(name);
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[config] Environment variable ${name} must be an integer, got: "${raw}"`);
  }
  return parsed;
}

// ─── Server ──────────────────────────────────────────────────────────────────
export const SERVER_HOST = optionalEnv('SERVER_HOST', '0.0.0.0');
export const SERVER_PORT = parseInt(optionalEnv('SERVER_PORT', '3000'), 10);
export const NODE_ENV = optionalEnv('NODE_ENV', 'development');
export const IS_PRODUCTION = NODE_ENV === 'production';
export const LOG_LEVEL = optionalEnv('LOG_LEVEL', IS_PRODUCTION ? 'info' : 'debug');

// ─── Database ────────────────────────────────────────────────────────────────
export const DB_HOST = requireEnv('DB_HOST');
export const DB_PORT = requireIntEnv('DB_PORT');
export const DB_NAME = requireEnv('DB_NAME');
export const DB_USER = requireEnv('DB_USER');
export const DB_PASSWORD = requireEnv('DB_PASSWORD');
export const DB_SSL = optionalEnv('DB_SSL', 'false') === 'true';
export const DB_POOL_MAX = parseInt(optionalEnv('DB_POOL_MAX', '10'), 10);
export const DB_POOL_MIN = parseInt(optionalEnv('DB_POOL_MIN', '2'), 10);
export const DB_IDLE_TIMEOUT_MS = parseInt(optionalEnv('DB_IDLE_TIMEOUT_MS', '30000'), 10);
export const DB_CONNECTION_TIMEOUT_MS = parseInt(optionalEnv('DB_CONNECTION_TIMEOUT_MS', '5000'), 10);

// ─── CORS ────────────────────────────────────────────────────────────────────
export const CORS_ORIGIN = optionalEnv('CORS_ORIGIN', 'http://localhost:3001');

// ─── JWT (RS256 Asymmetric) ────────────────────────────────────────────────────
// PEM keys may be stored with literal \n sequences in .env — we unescape them.
function loadPemKey(name: string): string {
  const raw = requireEnv(name);
  return raw.replace(/\\n/g, '\n');
}
export const JWT_PRIVATE_KEY = loadPemKey('JWT_PRIVATE_KEY');
export const JWT_PUBLIC_KEY  = loadPemKey('JWT_PUBLIC_KEY');
export const JWT_EXPIRES_IN  = optionalEnv('JWT_EXPIRES_IN', '30d');
export const JWT_ISSUER      = optionalEnv('JWT_ISSUER',     'bolti-kitab');
export const JWT_AUDIENCE    = optionalEnv('JWT_AUDIENCE',   'bolti-kitab-client');

// ─── Object Storage ────────────────────────────────────────────────────────────────────────────────
// STORAGE_PROVIDER: mock (default for safety and hermetic tests) | b2 (active Phase 1) | azure
export const STORAGE_PROVIDER = optionalEnv('STORAGE_PROVIDER', 'mock');

// Backblaze B2 (S3-Compatible API - Active Phase 1 Real Provider)
export const B2_ENDPOINT        = optionalEnv('B2_ENDPOINT', 'https://s3.eu-central-003.backblazeb2.com');
export const B2_REGION          = optionalEnv('B2_REGION', 'eu-central-003');
export const B2_BUCKET_NAME     = optionalEnv('B2_BUCKET_NAME', 'bolti-kitab-media');
export const B2_KEY_ID          = optionalEnv('B2_KEY_ID', '');
export const B2_APPLICATION_KEY = optionalEnv('B2_APPLICATION_KEY', '');

// Azure Blob Storage (Alternate Provider - Retained)
export const AZURE_STORAGE_ACCOUNT_NAME = optionalEnv(
  'AZURE_STORAGE_ACCOUNT_NAME',
  optionalEnv('STORAGE_ACCOUNT_NAME', '')
);
export const AZURE_STORAGE_ACCOUNT_KEY = optionalEnv(
  'AZURE_STORAGE_ACCOUNT_KEY',
  optionalEnv('STORAGE_ACCOUNT_KEY', '')
);
export const AZURE_STORAGE_CONNECTION_STRING = optionalEnv('AZURE_STORAGE_CONNECTION_STRING', '');
export const AZURE_STORAGE_CONTAINER_NAME = optionalEnv(
  'AZURE_STORAGE_CONTAINER_NAME',
  optionalEnv(
    'AZURE_CONTAINER_AUDIO_PRIVATE',
    optionalEnv('STORAGE_CONTAINER_NAME', 'audiobooks-private')
  )
);

// TTL Settings
export const STORAGE_UPLOAD_TTL_SECONDS = parseInt(
  optionalEnv(
    'STORAGE_UPLOAD_TTL_SECONDS',
    optionalEnv('AZURE_SAS_UPLOAD_EXPIRATION_SECONDS', optionalEnv('UPLOAD_TOKEN_TTL_SECONDS', '1800'))
  ),
  10
);
export const STORAGE_PLAYBACK_TTL_SECONDS = parseInt(
  optionalEnv(
    'STORAGE_PLAYBACK_TTL_SECONDS',
    optionalEnv('AZURE_SAS_PLAYBACK_EXPIRATION_SECONDS', '86400')
  ),
  10
);

// ─── Consolidated config object (for injection/testing convenience) ──────────
export const config = {
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
    nodeEnv: NODE_ENV,
    isProduction: IS_PRODUCTION,
    logLevel: LOG_LEVEL,
  },
  db: {
    host: DB_HOST,
    port: DB_PORT,
    name: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL,
    pool: {
      max: DB_POOL_MAX,
      min: DB_POOL_MIN,
      idleTimeoutMs: DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
    },
  },
  cors: {
    origin: CORS_ORIGIN,
  },
  jwt: {
    privateKey: JWT_PRIVATE_KEY,
    publicKey:  JWT_PUBLIC_KEY,
    expiresIn:  JWT_EXPIRES_IN,
    issuer:     JWT_ISSUER,
    audience:   JWT_AUDIENCE,
  },
  storage: {
    provider:         STORAGE_PROVIDER,
    b2: {
      endpoint:       B2_ENDPOINT,
      region:         B2_REGION,
      bucketName:     B2_BUCKET_NAME,
      keyId:          B2_KEY_ID,
      applicationKey: B2_APPLICATION_KEY,
    },
    azure: {
      accountName:      AZURE_STORAGE_ACCOUNT_NAME,
      accountKey:       AZURE_STORAGE_ACCOUNT_KEY,
      connectionString: AZURE_STORAGE_CONNECTION_STRING,
      containerName:    AZURE_STORAGE_CONTAINER_NAME,
    },
    // Top-level aliases for backwards compatibility
    accountName:      AZURE_STORAGE_ACCOUNT_NAME,
    accountKey:       AZURE_STORAGE_ACCOUNT_KEY,
    connectionString: AZURE_STORAGE_CONNECTION_STRING,
    containerName:    AZURE_STORAGE_CONTAINER_NAME,
    uploadTtlSeconds: STORAGE_UPLOAD_TTL_SECONDS,
    playbackTtlSeconds: STORAGE_PLAYBACK_TTL_SECONDS,
  },
} as const;
