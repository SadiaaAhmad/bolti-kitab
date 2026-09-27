/**
 * Bolti Kitab — Playback & Listening Progress Integration Tests
 *
 * DATABASE:    bolti_kitab_test  (ISOLATED)
 * TEST RUNNER: Node.js built-in test runner (node:test)
 */

import '../../test/setup-env.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateTestUsers,
  truncateTestCatalog,
  truncateTestRecordings,
  truncateTestPlayback,
  getTestPool,
} from '../../test/db-setup.js';

import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { getStorageProvider, resetStorageProvider } from '../../storage/index.js';

const BASE = '/api/v1/playback';
const tag = () => crypto.randomBytes(4).toString('hex');

interface CreatedUser {
  id: string;
  token: string;
  email: string;
}

async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  role: 'listener' | 'editor' | 'admin',
): Promise<CreatedUser> {
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'SecureP@ss123!', full_name: 'Test Listener' },
  });
  assert.equal(regRes.statusCode, 201, `Register ${email}: ${regRes.body}`);
  const user = (JSON.parse(regRes.body) as { user: { id: string } }).user;

  if (role !== 'listener') {
    const pool = getTestPool();
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);
  }

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'SecureP@ss123!' },
  });
  assert.equal(loginRes.statusCode, 200, `Login ${email}: ${loginRes.body}`);
  const { token } = JSON.parse(loginRes.body) as { token: string };

  return { id: user.id, token, email };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Playback & Listening Progress Module', () => {
  let app: FastifyInstance;

  let listener: CreatedUser;
  let editor: CreatedUser;
  let admin: CreatedUser;

  let bookId: string;
  let chapterPreviewId: string; // chapter 1 (free preview, approved)
  let chapterPaidId: string;    // chapter 2 (paid, approved)
  let chapterPendingId: string; // chapter 3 (pending audio)

  before(async () => {
    process.env['STORAGE_PROVIDER'] = 'mock';
    process.env['DB_NAME'] = 'bolti_kitab_test';

    getStorageProvider();
    await setupTestDatabase();
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await truncateTestPlayback();
    await truncateTestRecordings();
    await truncateTestCatalog();
    await truncateTestUsers();
    await teardownTestDatabase();
    resetStorageProvider();
    await app.close();
  });

  it('[1] Setup: create users, active book, and chapters with audio', async () => {
    const t = tag();
    listener = await registerAndLogin(app, `listener-${t}@boltikitab.test`, 'listener');
    editor   = await registerAndLogin(app, `editor-${t}@boltikitab.test`, 'editor');
    admin    = await registerAndLogin(app, `admin-${t}@boltikitab.test`, 'admin');

    const pool = getTestPool();

    // 1. Insert active Book
    const bookRes = await pool.query<{ id: string }>(`
      INSERT INTO books (title, title_urdu, author, narrator_name, language, status, price_cents, published_at)
      VALUES ('The Art of War', 'فنِ حرب', 'Sun Tzu', 'Bob Neufeld', 'en', 'active', 25000, CURRENT_TIMESTAMP)
      RETURNING id
    `);
    bookId = bookRes.rows[0]!.id;

    // 2. Insert Chapter 1 (is_preview_free = true, status = approved)
    const ch1Res = await pool.query<{ id: string }>(`
      INSERT INTO chapters (book_id, chapter_num, title, start_ms, end_ms, duration_ms, audio_object_key, is_preview_free, status)
      VALUES ($1, 1, 'Part 1: Laying Plans', 0, 120000, 120000, 'recordings/sess-1/take-1.mp3', TRUE, 'approved')
      RETURNING id
    `, [bookId]);
    chapterPreviewId = ch1Res.rows[0]!.id;

    // 3. Insert Chapter 2 (is_preview_free = false, status = approved)
    const ch2Res = await pool.query<{ id: string }>(`
      INSERT INTO chapters (book_id, chapter_num, title, start_ms, end_ms, duration_ms, audio_object_key, is_preview_free, status)
      VALUES ($1, 2, 'Part 2: Waging War', 120000, 240000, 120000, 'recordings/sess-1/take-2.mp3', FALSE, 'approved')
      RETURNING id
    `, [bookId]);
    chapterPaidId = ch2Res.rows[0]!.id;

    // 4. Insert Chapter 3 (is_preview_free = false, status = pending, audio_object_key = null)
    const ch3Res = await pool.query<{ id: string }>(`
      INSERT INTO chapters (book_id, chapter_num, title, start_ms, end_ms, duration_ms, audio_object_key, is_preview_free, status)
      VALUES ($1, 3, 'Part 3: Attack by Stratagem', 240000, 360000, 120000, NULL, FALSE, 'pending')
      RETURNING id
    `, [bookId]);
    chapterPendingId = ch3Res.rows[0]!.id;

    assert.ok(bookId);
    assert.ok(chapterPreviewId);
    assert.ok(chapterPaidId);
    assert.ok(chapterPendingId);
  });

  it('[2] GET /books/:bookId returns overview with chapters and is_entitled=false for unentitled listener', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      book_id: string;
      title: string;
      is_entitled: boolean;
      chapters: { id: string; is_preview_free: boolean; is_approved: boolean }[];
      progress: unknown;
    };
    assert.equal(body.book_id, bookId);
    assert.equal(body.is_entitled, false);
    assert.equal(body.chapters.length, 3);
    assert.equal(body.progress, null);
  });

  it('[3] GET /books/:bookId/chapters/:chapterId allows unentitled listener to play preview-free chapter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPreviewId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      chapter_id: string;
      playback_url: string;
      expires_at: string;
      format: string;
    };
    assert.equal(body.chapter_id, chapterPreviewId);
    assert.ok(body.playback_url.startsWith('mock://storage/download/'));
    assert.ok(body.expires_at);
  });

  it('[4] GET /books/:bookId/chapters/:chapterId blocks unentitled listener from non-preview chapter -> 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPaidId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 403, `Expected 403: ${res.body}`);
  });

  it('[5] GET /books/:bookId/chapters/:chapterId allows editor/admin to stream any chapter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPaidId}`,
      headers: authHeader(editor.token),
    });
    assert.equal(res.statusCode, 200, res.body);
  });

  it('[6] Grant active entitlement -> listener can now stream paid chapter', async () => {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO entitlements (user_id, book_id, grant_type, status)
      VALUES ($1, $2, 'direct_purchase', 'active')
    `, [listener.id, bookId]);

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPaidId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 200, res.body);
  });

  it('[7] GET /books/:bookId/chapters/:chapterId rejects unapproved chapter without audio -> 409', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPendingId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 409, `Expected 409: ${res.body}`);
  });

  it('[8] PUT /books/:bookId/progress saves current position and chapter', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `${BASE}/books/${bookId}/progress`,
      headers: authHeader(listener.token),
      payload: {
        chapter_id: chapterPaidId,
        position_ms: 45000,
        update_seq: 1,
        is_completed: false,
      },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      chapter_id: string;
      position_ms: number;
      update_seq: number;
      is_completed: boolean;
    };
    assert.equal(body.chapter_id, chapterPaidId);
    assert.equal(body.position_ms, 45000);
    assert.equal(body.update_seq, 1);
  });

  it('[9] GET /books/:bookId/progress retrieves saved listening state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/progress`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      chapter_id: string;
      position_ms: number;
      update_seq: number;
    };
    assert.equal(body.chapter_id, chapterPaidId);
    assert.equal(body.position_ms, 45000);
  });

  it('[10] PUT /books/:bookId/progress with higher update_seq updates position', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `${BASE}/books/${bookId}/progress`,
      headers: authHeader(listener.token),
      payload: {
        chapter_id: chapterPaidId,
        position_ms: 90000,
        update_seq: 2,
        is_completed: false,
      },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as { position_ms: number; update_seq: number };
    assert.equal(body.position_ms, 90000);
    assert.equal(body.update_seq, 2);
  });

  it('[11] GET /books/:bookId overview now reflects updated listening progress', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}`,
      headers: authHeader(listener.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      is_entitled: boolean;
      progress: { chapter_id: string; position_ms: number };
    };
    assert.equal(body.is_entitled, true);
    assert.ok(body.progress);
    assert.equal(body.progress.chapter_id, chapterPaidId);
    assert.equal(body.progress.position_ms, 90000);
  });

  it('[12] Unauthenticated request to playback fails -> 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/books/${bookId}/chapters/${chapterPreviewId}`,
    });
    assert.equal(res.statusCode, 401);
  });
});
