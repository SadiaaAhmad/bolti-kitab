/**
 * Bolti Kitab — Auth Service
 *
 * Provides database queries and business logic for registration, login, and
 * current-user retrieval. All SQL uses parameterized queries — no string concatenation.
 *
 * Security invariants enforced here:
 * - Email is normalized (lowercased + trimmed) before lookup and storage.
 * - A dummy hash verification runs even when user is not found, preventing
 *   timing-based email enumeration attacks.
 * - password_hash is never included in returned SafeUser objects.
 * - Suspended users receive a distinct 403, not a 401, to avoid account fishing
 *   while still being informative to the legitimate account holder.
 */

import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { hashPassword, verifyPassword, signAccessToken } from './crypto.js';
import type { SafeUser, UserRole, UserStatus } from './types.js';

// ─── Internal DB Row (includes password_hash — never expose externally) ────────
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

// ─── Pre-computed dummy hash for timing-safe user-not-found paths ─────────────
// We verify a fixed hash when the user doesn't exist to prevent timing attacks.
// This hash is stable, public, and has no security significance.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaasfNiu6nWhTjEJVY';

// ─── Email Normalization ──────────────────────────────────────────────────────
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ─── Safe User Projection ─────────────────────────────────────────────────────
function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

// ─── DB Queries ───────────────────────────────────────────────────────────────

async function findUserByEmail(
  email: string,
  client?: PoolClient,
): Promise<UserRow | null> {
  const db = client ?? pool;
  const result = await db.query<UserRow>(
    `SELECT id, email, password_hash, full_name, role, status, created_at, updated_at
       FROM users
      WHERE email = $1
      LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function findUserById(id: string, client?: PoolClient): Promise<UserRow | null> {
  const db = client ?? pool;
  const result = await db.query<UserRow>(
    `SELECT id, email, password_hash, full_name, role, status, created_at, updated_at
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

// ─── Register ────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

export interface RegisterResult {
  user: SafeUser;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const fullName = input.full_name.trim();

  // Check for existing user with same email
  const existing = await findUserByEmail(email);
  if (existing !== null) {
    const err = new Error('An account with this email address already exists.');
    (err as NodeJS.ErrnoException).code = 'EMAIL_TAKEN';
    throw err;
  }

  const passwordHash = await hashPassword(input.password);

  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role, status)
          VALUES ($1,    $2,            $3,        'listener', 'active')
       RETURNING id, email, password_hash, full_name, role, status, created_at, updated_at`,
    [email, passwordHash, fullName],
  );

  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('User creation failed unexpectedly.');
  }

  return { user: toSafeUser(row) };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  expires_in: string;
  user: SafeUser;
}

// Generic error message used for all authentication failures (prevents email enumeration)
const AUTH_ERROR_MSG = 'Invalid email or password.';

export async function loginUser(
  input: LoginInput,
  jwtExpiresIn: string,
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);

  const userRow = await findUserByEmail(email);

  if (userRow === null) {
    // Perform dummy verification to equalize timing with valid user path
    await verifyPassword(DUMMY_HASH, input.password);
    const err = new Error(AUTH_ERROR_MSG);
    (err as NodeJS.ErrnoException).code = 'AUTH_INVALID';
    throw err;
  }

  const passwordValid = await verifyPassword(userRow.password_hash, input.password);
  if (!passwordValid) {
    const err = new Error(AUTH_ERROR_MSG);
    (err as NodeJS.ErrnoException).code = 'AUTH_INVALID';
    throw err;
  }

  if (userRow.status === 'suspended') {
    const err = new Error('Your account has been suspended. Please contact support.');
    (err as NodeJS.ErrnoException).code = 'ACCOUNT_SUSPENDED';
    throw err;
  }

  const token = signAccessToken({
    sub: userRow.id,
    email: userRow.email,
    role: userRow.role,
  });

  return {
    token,
    expires_in: jwtExpiresIn,
    user: toSafeUser(userRow),
  };
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export interface GetCurrentUserResult {
  user: SafeUser;
}

export async function getCurrentUser(id: string): Promise<GetCurrentUserResult> {
  const userRow = await findUserById(id);

  if (userRow === null) {
    const err = new Error('User not found.');
    (err as NodeJS.ErrnoException).code = 'USER_NOT_FOUND';
    throw err;
  }

  return { user: toSafeUser(userRow) };
}
