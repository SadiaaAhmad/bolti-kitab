/**
 * Bolti Kitab — Auth Module Shared Types
 *
 * Defines the core types used across auth service, plugin, and routes.
 * Import from here — do NOT re-define locally in individual files.
 */

// ─── User Roles ───────────────────────────────────────────────────────────────
export type UserRole = 'listener' | 'narrator' | 'editor' | 'admin';
export const USER_ROLES: readonly UserRole[] = ['listener', 'narrator', 'editor', 'admin'] as const;

// ─── User Status ──────────────────────────────────────────────────────────────
export type UserStatus = 'active' | 'suspended' | 'pending_verification';

// ─── Safe User — never contains password_hash ─────────────────────────────────
export interface SafeUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;        // User UUID
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

// ─── Authenticated Request Context ───────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
