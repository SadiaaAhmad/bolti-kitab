/**
 * Bolti Kitab -- Recordings Module Integration Tests
 *
 * DATABASE:    bolti_kitab_test  (ISOLATED -- never touches bolti_kitab_dev)
 * TEST RUNNER: Node.js built-in test runner (node:test)
 *
 * Full lifecycle coverage:
 *   [1]  Setup users (admin, narrator, editor, listener) + book + chapter
 *   [2]  Narrator creates recording session
 *   [3]  Narrator gets upload token -> recording row created (status=uploading)
 *   [4]  Confirm fails before simulating upload (object not in storage -> 422)
 *   [5]  Simulate upload; confirm take -> status=submitted_for_review
 *   [6]  Double-confirm rejected (status<>uploading -> 409)
 *   [7]  Cross-session ownership: narrator cannot confirm another session's take
 *   [8]  Narrator cannot access review-queue (403)
 *   [9]  Listener cannot access any recording endpoint (403)
 *   [10] Editor sees take in review-queue
 *   [11] Editor rejects take with notes
 *   [12] Approve on rejected take -> 409 (invalid state transition)
 *   [13] Narrator requests second upload token -> new recording row
 *   [14] Second upload simulated + confirmed
 *   [15] Editor approves second take
 *   [16] Chapter audio_object_key updated to approved take's blob key
 *   [17] Chapter status = approved
 *   [18] Session status = completed
 *   [19] Editor cannot get upload token (not narrator/admin role)
 *   [20] Admin can see all sessions (not scoped to own narrator_id)
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
  getTestPool,
} from '../../test/db-setup.js';

import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { getStorageProvider, resetStorageProvider } from '../../storage/index.js';
import type { MockStorageProvider } from '../../storage/mock-provider.js';

// --- Constants ---

const BASE = '/api/v1';
const tag = () => crypto.randomBytes(4).toString('hex');

// --- Test fixtures ---

interface CreatedUser {
  id: string;
  token: string;
  email: string;
}

async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  role: 'listener' | 'narrator' | 'editor' | 'admin',
): Promise<CreatedUser> {
  // Register
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'SecureP@ss123!', full_name: 'Test User' },
  });
  assert.equal(regRes.statusCode, 201, `Register ${email}: ${regRes.body}`);
  const user = (JSON.parse(regRes.body) as { user: { id: string } }).user;

  // Set role via direct DB update if not listener (default is listener)
  if (role !== 'listener') {
    const pool = getTestPool();
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);
  }

  // Login
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

// --- Tests ---

describe('Recordings Module', () => {
  let app: FastifyInstance;

  // Test users
  let admin: CreatedUser;
  let narrator: CreatedUser;
  let editor: CreatedUser;
  let listener: CreatedUser;

  // Test entities
  let bookId: string;
  let chapterId: string;
  let sessionId: string;

  // First take state
  let recordingId1: string;
  let blobKey1: string;

  // Second take state
  let recordingId2: string;
  let blobKey2: string;

  before(async () => {
    // Set mock storage before app builds so singleton is initialized correctly
    process.env['STORAGE_PROVIDER'] = 'mock';
    process.env['DB_NAME'] = 'bolti_kitab_test';

    getStorageProvider();
    await setupTestDatabase();
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await truncateTestRecordings();
    await truncateTestCatalog();
    await truncateTestUsers();
    await teardownTestDatabase();
    resetStorageProvider();
    await app.close();
  });

  it('[1] Setup: create users, book, and chapter', async () => {
    const t = tag();
    admin    = await registerAndLogin(app, `admin-${t}@boltikitab.test`, 'admin');
    narrator = await registerAndLogin(app, `narrator-${t}@boltikitab.test`, 'narrator');
    editor   = await registerAndLogin(app, `editor-${t}@boltikitab.test`, 'editor');
    listener = await registerAndLogin(app, `listener-${t}@boltikitab.test`, 'listener');

    // Admin creates a book
    const bookRes = await app.inject({
      method: 'POST',
      url: `${BASE}/books`,
      headers: authHeader(admin.token),
      payload: {
        title: 'Test Book',
        title_urdu: 'ٹیسٹ کتاب',
        author: 'Test Author',
        narrator_name: 'Test Narrator',
      },
    });
    assert.equal(bookRes.statusCode, 201, `Create book: ${bookRes.body}`);
    bookId = (JSON.parse(bookRes.body) as { book: { id: string } }).book.id;

    // Admin creates a chapter
    const chapterRes = await app.inject({
      method: 'POST',
      url: `${BASE}/books/${bookId}/chapters`,
      headers: authHeader(admin.token),
      payload: {
        chapter_num: 1,
        title: 'Chapter 1',
        title_urdu: 'باب 1',
        start_ms: 0,
        end_ms: 300000,
      },
    });
    assert.equal(chapterRes.statusCode, 201, `Create chapter: ${chapterRes.body}`);
    chapterId = (JSON.parse(chapterRes.body) as { chapter: { id: string } }).chapter.id;

    assert.ok(bookId, 'bookId must be set');
    assert.ok(chapterId, 'chapterId must be set');
  });

  it('[2] Narrator creates a recording session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recording-sessions`,
      headers: authHeader(narrator.token),
      payload: { book_id: bookId, chapter_id: chapterId, notes: 'First session' },
    });
    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body) as {
      id: string;
      status: string;
      narrator_id: string;
    };
    assert.equal(body.status, 'in_progress');
    assert.equal(body.narrator_id, narrator.id);
    sessionId = body.id;
  });

  it('[3] Narrator gets upload token -- recordings row created with status=uploading', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recording-sessions/${sessionId}/upload-token`,
      headers: authHeader(narrator.token),
    });
    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body) as {
      recording_id: string;
      blob_key: string;
      upload_url: string;
      expires_at: string;
    };
    assert.ok(body.recording_id, 'recording_id must be present');
    assert.ok(body.blob_key.startsWith('recordings/'), 'blob_key must use server-generated path');
    assert.ok(body.upload_url.startsWith('mock://'), 'upload_url must come from mock provider');
    assert.ok(body.expires_at, 'expires_at must be present');

    recordingId1 = body.recording_id;
    blobKey1 = body.blob_key;
  });

  it('[4] Confirm take fails before simulating upload (objectExists = false -> 422)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recordings/${recordingId1}/confirm`,
      headers: authHeader(narrator.token),
      payload: { duration_ms: 60000, file_size_bytes: 5000000, sample_rate_hz: 44100, channels: 1 },
    });
    assert.equal(res.statusCode, 422, `Expected 422, got ${res.statusCode}: ${res.body}`);
  });

  it('[5] Simulate upload; confirm take -> submitted_for_review', async () => {
    // Simulate narrator completing PUT to storage
    const storage = getStorageProvider() as MockStorageProvider;
    storage.simulateUpload(blobKey1);

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recordings/${recordingId1}/confirm`,
      headers: authHeader(narrator.token),
      payload: { duration_ms: 60000, file_size_bytes: 5000000, sample_rate_hz: 44100, channels: 1 },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as { status: string; take_number: number };
    assert.equal(body.status, 'submitted_for_review');
    assert.equal(body.take_number, 1);
  });

  it('[6] Double-confirm rejected -- status is no longer uploading -> 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recordings/${recordingId1}/confirm`,
      headers: authHeader(narrator.token),
      payload: { duration_ms: 60000, file_size_bytes: 5000000, sample_rate_hz: 44100, channels: 1 },
    });
    assert.equal(res.statusCode, 409, `Expected 409: ${res.body}`);
  });

  it('[7] Narrator cannot confirm a take from a session they do not own', async () => {
    // Create a second narrator to test cross-session ownership
    const t = tag();
    const narrator2 = await registerAndLogin(app, `narrator2-${t}@boltikitab.test`, 'narrator');

    // narrator2 attempts to confirm narrator's recording
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recordings/${recordingId1}/confirm`,
      headers: authHeader(narrator2.token),
      payload: { duration_ms: 60000, file_size_bytes: 5000000, sample_rate_hz: 44100, channels: 1 },
    });
    assert.equal(res.statusCode, 403, `Expected 403: ${res.body}`);
  });

  it('[8] Narrator cannot access review-queue -> 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/recordings/review-queue`,
      headers: authHeader(narrator.token),
    });
    assert.equal(res.statusCode, 403, `Expected 403: ${res.body}`);
  });

  it('[9] Listener cannot access any recording endpoint -> 403', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: `${BASE}/recording-sessions`,
      headers: authHeader(listener.token),
    });
    assert.equal(res1.statusCode, 403, `Expected 403: ${res1.body}`);

    const res2 = await app.inject({
      method: 'POST',
      url: `${BASE}/recording-sessions`,
      headers: authHeader(listener.token),
      payload: { book_id: bookId, chapter_id: chapterId },
    });
    assert.equal(res2.statusCode, 403, `Expected 403: ${res2.body}`);

    const res3 = await app.inject({
      method: 'GET',
      url: `${BASE}/recordings/review-queue`,
      headers: authHeader(listener.token),
    });
    assert.equal(res3.statusCode, 403, `Expected 403: ${res3.body}`);
  });

  it('[10] Editor sees take in review-queue', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/recordings/review-queue`,
      headers: authHeader(editor.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as { data: { id: string; status: string }[]; total: number };
    assert.ok(body.total >= 1, 'review-queue must have at least one take');
    const take = body.data.find((t) => t.id === recordingId1);
    assert.ok(take, 'take1 must appear in review-queue');
    assert.equal(take.status, 'submitted_for_review');
  });

  it('[11] Editor rejects take with notes', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/recordings/${recordingId1}/reject`,
      headers: authHeader(editor.token),
      payload: { review_notes: 'Background noise detected. Please re-record.' },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      status: string;
      review_notes: string;
      reviewed_by: string;
    };
    assert.equal(body.status, 'rejected');
    assert.equal(body.review_notes, 'Background noise detected. Please re-record.');
    assert.equal(body.reviewed_by, editor.id);
  });

  it('[12] Approve on rejected take -> 409 (invalid state transition)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/recordings/${recordingId1}/approve`,
      headers: authHeader(editor.token),
    });
    assert.equal(res.statusCode, 409, `Expected 409: ${res.body}`);
  });

  it('[13] Narrator requests second upload token -> new recording row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recording-sessions/${sessionId}/upload-token`,
      headers: authHeader(narrator.token),
    });
    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body) as {
      recording_id: string;
      blob_key: string;
      upload_url: string;
      expires_at: string;
    };
    assert.notEqual(body.recording_id, recordingId1, 'Must be a different recording row');
    assert.notEqual(body.blob_key, blobKey1, 'Must have a different blob key');
    assert.ok(body.blob_key.startsWith('recordings/'), 'blob_key must use server-generated path');

    recordingId2 = body.recording_id;
    blobKey2 = body.blob_key;
  });

  it('[14] Second upload simulated + confirmed -> submitted_for_review', async () => {
    const storage = getStorageProvider() as MockStorageProvider;
    storage.simulateUpload(blobKey2);

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recordings/${recordingId2}/confirm`,
      headers: authHeader(narrator.token),
      payload: { duration_ms: 65000, file_size_bytes: 5500000, sample_rate_hz: 48000, channels: 2 },
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as {
      status: string;
      take_number: number;
      sample_rate_hz: number;
      channels: number;
    };
    assert.equal(body.status, 'submitted_for_review');
    assert.equal(body.take_number, 2);
    assert.equal(body.sample_rate_hz, 48000);
    assert.equal(body.channels, 2);
  });

  it('[15] Editor approves second take -> 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/recordings/${recordingId2}/approve`,
      headers: authHeader(editor.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as { status: string; reviewed_by: string };
    assert.equal(body.status, 'approved');
    assert.equal(body.reviewed_by, editor.id);
  });

  it('[16] Chapter audio_object_key updated to approved take blob key', async () => {
    const pool = getTestPool();
    const result = await pool.query<{ audio_object_key: string }>(
      'SELECT audio_object_key FROM chapters WHERE id = $1',
      [chapterId],
    );
    const row = result.rows[0];
    assert.ok(row, 'chapter row must exist');
    assert.equal(row.audio_object_key, blobKey2,
      "Chapter audio_object_key must match approved take's blob key");
  });

  it('[17] Chapter status updated to approved', async () => {
    const pool = getTestPool();
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM chapters WHERE id = $1',
      [chapterId],
    );
    assert.equal(result.rows[0]?.status, 'approved');
  });

  it('[18] Session status updated to completed', async () => {
    const pool = getTestPool();
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM recording_sessions WHERE id = $1',
      [sessionId],
    );
    assert.equal(result.rows[0]?.status, 'completed');
  });

  it('[19] Editor cannot get upload token (not narrator/admin) -> 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/recording-sessions/${sessionId}/upload-token`,
      headers: authHeader(editor.token),
    });
    assert.equal(res.statusCode, 403, `Expected 403: ${res.body}`);
  });

  it('[20] Admin can list all sessions (not scoped to own narrator_id)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/recording-sessions`,
      headers: authHeader(admin.token),
    });
    assert.equal(res.statusCode, 200, res.body);
    const sessions = JSON.parse(res.body) as { id: string }[];
    assert.ok(
      sessions.some((s) => s.id === sessionId),
      'Admin must see the narrator session',
    );
  });
});
