/**
 * Bolti Kitab — Auth Cryptography Helpers
 *
 * Provides Argon2id password hashing and RS256 JWT signing/verification.
 *
 * SECURITY NOTES:
 * - Argon2id parameters (memory=65536, time=3, parallelism=4) are OWASP-recommended.
 * - JWT is RS256 asymmetric: the private key signs tokens, public key verifies.
 * - Private key MUST come exclusively from environment config — never hardcoded.
 * - Verification uses { algorithms: ['RS256'] } to prevent algorithm confusion attacks.
 */

import { hash as argon2Hash, verify as argon2Verify, argon2id } from 'argon2';
import type { HashOptions } from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import type { JwtPayload } from './types.js';

// ─── Argon2id Parameters ──────────────────────────────────────────────────────
// OWASP recommended minimum for Argon2id:
//   memoryCost: 65536 KiB (64 MB)
//   timeCost:   3 iterations
//   parallelism: 4 threads
const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
};

// ─── Password Hashing ────────────────────────────────────────────────────────
export async function hashPassword(plainPassword: string): Promise<string> {
  // hash() returns Promise<string> when raw is omitted (default false)
  return argon2Hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await argon2Verify(storedHash, plainPassword);
  } catch {
    // Treat malformed hashes as verification failure, not a crash
    return false;
  }
}

// ─── JWT Signing ──────────────────────────────────────────────────────────────
export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
): string {
  // Explicitly type options to avoid exactOptionalPropertyTypes issues.
  // All values are guaranteed non-undefined by config validation.
  // expiresIn cast: StringValue is a branded ms type; our env value is always valid.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: jwt.SignOptions = {
    algorithm: 'RS256' as const,
    expiresIn: config.jwt.expiresIn as any,
    issuer:    config.jwt.issuer,
    audience:  config.jwt.audience,
  };
  return jwt.sign(payload as object, config.jwt.privateKey, opts);
}

// ─── JWT Verification ─────────────────────────────────────────────────────────
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.publicKey, {
    algorithms: ['RS256'],
    issuer:  config.jwt.issuer,
    audience: config.jwt.audience,
  });

  if (typeof decoded === 'string' || !decoded['sub']) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return decoded as unknown as JwtPayload;
}
