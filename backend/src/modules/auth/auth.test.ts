/**
 * Bolti Kitab — Auth Module Tests
 *
 * DATABASE:      bolti_kitab_test  (ISOLATED — never touches bolti_kitab_dev)
 * TEST RUNNER:   Node.js built-in test runner (node:test)
 * ISOLATION:     Full TRUNCATE of users table before each test via truncateTestUsers()
 *
 * Test cases:
 *   [1]  POST /register — successful registration (201, sanitized user, no password_hash)
 *   [2]  POST /register — duplicate email rejection (409)
 *   [3]  POST /register — weak password (400)
 *   [4]  POST /register — invalid email format (400)
 *   [5]  POST /login    — successful login (200, valid JWT returned)
 *   [6]  POST /login    — incorrect password (401, consistent message)
 *   [7]  POST /login    — non-existent user (401, same message as wrong password)
 *   [8]  POST /login    — suspended user (403)
 *   [9]  GET  /me       — authenticated with valid JWT (200, user profile)
 *   [10] GET  /me       — missing Authorization header (401)
 *   [11] GET  /me       — expired/invalid token (401)
 *   [12] requireRole   — admin-only route accessible by admin, 403 for listener
 */

import '../../test/setup-env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateTestUsers,
} from '../../test/db-setup.js';

import { buildApp } from '../../app.js';
import { pool as mainPool } from '../../db/pool.js';
import type { FastifyInstance } from 'fastify';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BASE = '/api/v1/auth';

interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  password_hash?: string;
}

interface RegisterResponse {
  user: UserResponse;
}

interface LoginResponse {
  token: string;
  expires_in: string;
  user: UserResponse;
}

function uniqueEmail(): string {
  return `test-${crypto.randomUUID()}@boltikitab.test`;
}

const STRONG_PASSWORD = 'Str0ng!Password#2026';
const TEST_FULL_NAME = 'Test User';

// ─── Test Suite ───────────────────────────────────────────────────────────────
let app: FastifyInstance;

before(async () => {
  console.log('\n[auth-test] === Setting up test database: bolti_kitab_test ===');
  await setupTestDatabase();

  assert.equal(
    mainPool.options.database,
    'bolti_kitab_test',
    `CRITICAL TEST ISOLATION FAILURE: Expected bolti_kitab_test but pool is connected to ${mainPool.options.database}!`,
  );

  app = await buildApp();
  console.log('[auth-test] App built and ready.');
});

after(async () => {
  console.log('\n[auth-test] === Tearing down test database ===');
  if (app) {
    await app.close();
  }
  await teardownTestDatabase();
});

beforeEach(async () => {
  await truncateTestUsers();
});

// ─── [1] Successful Registration ─────────────────────────────────────────────
describe('POST /register', () => {
  it('[1] returns 201 with safe user profile (no password_hash)', async () => {
    const email = uniqueEmail();
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json<RegisterResponse>();
    assert.ok(body.user);
    assert.equal(body.user.email, email);
    assert.equal(body.user.full_name, TEST_FULL_NAME);
    assert.equal(body.user.role, 'listener');
    assert.equal(body.user.status, 'active');
    assert.ok(body.user.id, 'id must be present');
    assert.ok(body.user.created_at, 'created_at must be present');
    // SECURITY: password_hash must never appear in the response
    assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
  });

  // ─── [2] Duplicate Email ─────────────────────────────────────────────────
  it('[2] rejects duplicate email with 409 Conflict', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    assert.equal(res.statusCode, 409);
    const body = res.json<{ message: string }>();
    assert.ok(body.message.includes('already exists'));
  });

  // ─── [3] Weak Password ───────────────────────────────────────────────────
  it('[3] rejects password shorter than 8 characters with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email: uniqueEmail(), password: 'short', full_name: TEST_FULL_NAME },
    });
    assert.equal(res.statusCode, 400);
  });

  // ─── [4] Invalid Email ───────────────────────────────────────────────────
  it('[4] rejects invalid email format with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email: 'not-an-email', password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });
    assert.equal(res.statusCode, 400);
  });
});

// ─── [5-8] Login ─────────────────────────────────────────────────────────────
describe('POST /login', () => {
  it('[5] returns 200 with JWT token on successful login', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email, password: STRONG_PASSWORD },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<LoginResponse>();
    assert.ok(body.token, 'token must be present');
    assert.ok(body.user, 'user must be present');
    assert.equal(body.user.email, email);
    assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
    // Verify token is structurally a JWT (three base64-separated segments)
    assert.equal(body.token.split('.').length, 3, 'token must be a JWT');
  });

  it('[6] returns 401 with consistent message on incorrect password', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email, password: 'WrongPassword123!' },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json<{ message: string }>();
    assert.equal(body.message, 'Invalid email or password.');
  });

  it('[7] returns 401 with same message for non-existent user (no email enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email: uniqueEmail(), password: STRONG_PASSWORD },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json<{ message: string }>();
    assert.equal(body.message, 'Invalid email or password.');
  });

  it('[8] returns 403 for suspended user', async () => {
    const email = uniqueEmail();

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });
    const userId = regRes.json<RegisterResponse>().user.id;

    // Use the main app's pool (same connection as service) to update status
    await mainPool.query(
      `UPDATE users SET status = 'suspended' WHERE id = $1`,
      [userId],
    );

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email, password: STRONG_PASSWORD },
    });

    assert.equal(res.statusCode, 403);
    const body = res.json<{ message: string }>();
    assert.ok(body.message.includes('suspended'));
  });
});

// ─── [9-11] /me endpoint ─────────────────────────────────────────────────────
describe('GET /me', () => {
  it('[9] returns 200 with user profile when authenticated with valid JWT', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email, password: STRONG_PASSWORD },
    });
    const { token } = loginRes.json<LoginResponse>();

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/me`,
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ user: UserResponse }>();
    assert.equal(body.user.email, email);
    assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
  });

  it('[10] returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/me`,
    });
    assert.equal(res.statusCode, 401);
  });

  it('[11] returns 401 for a malformed or invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/me`,
      headers: { Authorization: 'Bearer this.is.notvalid' },
    });
    assert.equal(res.statusCode, 401);
  });
});

// ─── [12] RBAC requireRole guard ─────────────────────────────────────────────
// This test requires a fresh Fastify instance with the admin-only route
// pre-registered before the server starts listening.
describe('requireRole RBAC guard', () => {
  it('[12] returns 403 for listener on admin-only route, 200 for admin', async () => {
    // Build a dedicated Fastify instance for this test with the admin-only route
    const rbacApp = await buildApp();
    rbacApp.get('/test/admin-only', {
      preHandler: [rbacApp.authenticate, rbacApp.requireRole('admin')],
    }, async (_req, reply) => reply.code(200).send({ ok: true }));

    // Register a listener
    const listenerEmail = uniqueEmail();
    await rbacApp.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email: listenerEmail, password: STRONG_PASSWORD, full_name: TEST_FULL_NAME },
    });
    const listenerLogin = await rbacApp.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email: listenerEmail, password: STRONG_PASSWORD },
    });
    const listenerToken = listenerLogin.json<LoginResponse>().token;

    // Register an admin user and elevate role
    const adminEmail = uniqueEmail();
    const regRes = await rbacApp.inject({
      method: 'POST',
      url: `${BASE}/register`,
      payload: { email: adminEmail, password: STRONG_PASSWORD, full_name: 'Admin User' },
    });
    const adminId = regRes.json<RegisterResponse>().user.id;
    await mainPool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminId]);

    const adminLogin = await rbacApp.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload: { email: adminEmail, password: STRONG_PASSWORD },
    });
    const adminToken = adminLogin.json<LoginResponse>().token;

    // Listener should get 403
    const listenerRes = await rbacApp.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: { Authorization: `Bearer ${listenerToken}` },
    });
    assert.equal(listenerRes.statusCode, 403);

    // Admin should get 200
    const adminRes = await rbacApp.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.statusCode, 200);

    await rbacApp.close();
  });
});
