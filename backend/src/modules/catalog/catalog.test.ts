/**
 * Bolti Kitab — Catalog Module Tests
 *
 * DATABASE:      bolti_kitab_test (ISOLATED — never touches bolti_kitab_dev)
 * TEST RUNNER:   Node.js built-in test runner (node:test)
 * ISOLATION:     Full TRUNCATE of books (and cascading chapters) before each test
 */

import '../../test/setup-env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateTestCatalog,
} from '../../test/db-setup.js';

import { buildApp } from '../../app.js';
import { pool as mainPool } from '../../db/pool.js';
import { signAccessToken } from '../auth/crypto.js';
import type { UserRole } from '../auth/types.js';
import type { FastifyInstance } from 'fastify';
import type {
  PublicBook,
  ManagementBook,
  PublicChapter,
  ManagementChapter,
  PaginatedBooksResult,
} from './types.js';

const BASE = '/api/v1/books';

let app: FastifyInstance;

function createToken(role: UserRole): string {
  const userId = crypto.randomUUID();
  const email = `${role}-${userId.slice(0, 8)}@boltikitab.test`;
  return signAccessToken({ sub: userId, email, role });
}

const editorToken = createToken('editor');
const adminToken = createToken('admin');
const listenerToken = createToken('listener');
const narratorToken = createToken('narrator');

// ─── Fixture Helper ───────────────────────────────────────────────────────────
async function seedBook(overrides: Partial<{
  title: string;
  title_urdu: string;
  author: string;
  narrator_name: string;
  language: string;
  status: string;
  price_cents: number;
  duration_seconds: number;
  published_at: string | null;
}> = {}): Promise<ManagementBook> {
  const res = await app.inject({
    method: 'POST',
    url: BASE,
    headers: { Authorization: `Bearer ${editorToken}` },
    payload: {
      title: overrides.title ?? 'Dastan-e-Amir Hamza',
      title_urdu: overrides.title_urdu ?? 'داستان امیر حمزہ',
      author: overrides.author ?? 'Ghalib Lakhnavi',
      narrator_name: overrides.narrator_name ?? 'Zia Mohyeddin',
      language: overrides.language ?? 'ur',
      status: overrides.status ?? 'active',
      price_cents: overrides.price_cents ?? 50000,
      duration_seconds: overrides.duration_seconds ?? 3600,
      published_at: overrides.published_at !== undefined ? overrides.published_at : new Date().toISOString(),
    },
  });

  assert.equal(res.statusCode, 201, `Failed to seed book: ${res.body}`);
  return res.json<{ book: ManagementBook }>().book;
}

// ─── Test Suite Setup ─────────────────────────────────────────────────────────
before(async () => {
  console.log('\n[catalog-test] === Setting up test database: bolti_kitab_test ===');
  await setupTestDatabase();

  assert.equal(
    mainPool.options.database,
    'bolti_kitab_test',
    `CRITICAL TEST ISOLATION FAILURE: Expected bolti_kitab_test but pool is connected to ${mainPool.options.database}!`,
  );

  app = await buildApp();
  console.log('[catalog-test] App built and ready.');
});

after(async () => {
  console.log('\n[catalog-test] === Tearing down test database ===');
  if (app) {
    await app.close();
  }
  await teardownTestDatabase();
});

beforeEach(async () => {
  await truncateTestCatalog();
});

// ─── 1. Public Book Listing & Role-Aware Filtering ────────────────────────────
describe('GET /api/v1/books', () => {
  it('[1] returns active books only by default for unauthenticated requests', async () => {
    await seedBook({ title: 'Active Book 1', status: 'active' });
    await seedBook({ title: 'Active Book 2', status: 'active' });
    await seedBook({ title: 'Draft Book', status: 'draft' });
    await seedBook({ title: 'Archived Book', status: 'archived' });

    const res = await app.inject({
      method: 'GET',
      url: BASE,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.total, 2);
    assert.equal(body.books.length, 2);
    body.books.forEach((b) => assert.equal(b.status, 'active'));
  });

  it('[2] security refinement: unauthenticated request passing ?status=draft still only receives active books', async () => {
    await seedBook({ title: 'Active Book', status: 'active' });
    await seedBook({ title: 'Draft Book', status: 'draft' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?status=draft`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.books[0]?.title, 'Active Book');
  });

  it('[3] security refinement: listener token passing ?status=draft still only receives active books', async () => {
    await seedBook({ title: 'Active Book', status: 'active' });
    await seedBook({ title: 'Draft Book', status: 'draft' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?status=draft`,
      headers: { Authorization: `Bearer ${listenerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.books[0]?.title, 'Active Book');
  });

  it('[4] editor/admin token CAN query draft books via ?status=draft', async () => {
    await seedBook({ title: 'Active Book', status: 'active' });
    await seedBook({ title: 'Draft Book', status: 'draft' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?status=draft`,
      headers: { Authorization: `Bearer ${editorToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<ManagementBook>>();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.books[0]?.title, 'Draft Book');
    assert.equal(body.books[0]?.status, 'draft');
  });

  it('[5] filters books by language correctly (?language=pa)', async () => {
    await seedBook({ title: 'Urdu Book', language: 'ur', status: 'active' });
    await seedBook({ title: 'Punjabi Book', language: 'pa', status: 'active' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?language=pa`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.books[0]?.language, 'pa');
    assert.equal(body.books[0]?.title, 'Punjabi Book');
  });

  it('[6] supports clean title and title_urdu search without extra search subsystems', async () => {
    await seedBook({ title: 'Shahnamah Firdousi', title_urdu: 'شاہنامہ فردوسی', status: 'active' });
    await seedBook({ title: 'Aab-e-Hayat', title_urdu: 'آب حیات', status: 'active' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?search=Shahnamah`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.books[0]?.title, 'Shahnamah Firdousi');
  });

  it('[7] respects pagination parameters page and limit', async () => {
    for (let i = 1; i <= 5; i++) {
      await seedBook({ title: `Book ${i}`, status: 'active' });
    }

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?page=2&limit=2`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<PaginatedBooksResult<PublicBook>>();
    assert.equal(body.pagination.page, 2);
    assert.equal(body.pagination.limit, 2);
    assert.equal(body.pagination.total, 5);
    assert.equal(body.pagination.total_pages, 3);
    assert.equal(body.books.length, 2);
  });
});

// ─── 2. Get Single Book by ID ─────────────────────────────────────────────────
describe('GET /api/v1/books/:id', () => {
  it('[8] returns 200 with safe public book metadata for active book', async () => {
    const seeded = await seedBook({ title: 'Heer Ranjha', status: 'active' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${seeded.id}`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ book: PublicBook }>();
    assert.equal(body.book.id, seeded.id);
    assert.equal(body.book.title, 'Heer Ranjha');
  });

  it('[9] returns 404 for non-existent book UUID', async () => {
    const nonExistent = crypto.randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${nonExistent}`,
    });

    assert.equal(res.statusCode, 404);
  });

  it('[10] public listener cannot view draft book by ID (returns 404)', async () => {
    const draftBook = await seedBook({ title: 'Unpublished Draft', status: 'draft' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${draftBook.id}`,
    });

    assert.equal(res.statusCode, 404);
  });

  it('[11] editor/admin CAN view draft book by ID (returns 200 with management projection)', async () => {
    const draftBook = await seedBook({ title: 'Unpublished Draft', status: 'draft' });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${draftBook.id}`,
      headers: { Authorization: `Bearer ${editorToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ book: ManagementBook }>();
    assert.equal(body.book.id, draftBook.id);
    assert.equal(body.book.status, 'draft');
  });
});

// ─── 3. Chapters Listing & Projection Security ────────────────────────────────
describe('GET /api/v1/books/:id/chapters', () => {
  it('[12] returns chapters strictly ordered by chapter_num ASC', async () => {
    const book = await seedBook({ status: 'active' });

    // Insert out of order
    await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 2, title: 'Chapter Two', start_ms: 1000, end_ms: 2000 },
    });
    await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'Chapter One', start_ms: 0, end_ms: 1000 },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${book.id}/chapters`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ chapters: PublicChapter[] }>();
    assert.equal(body.chapters.length, 2);
    assert.equal(body.chapters[0]?.chapter_num, 1);
    assert.equal(body.chapters[1]?.chapter_num, 2);
  });

  it('[13] security refinement: public chapter response omits internal status and audio_object_key', async () => {
    const book = await seedBook({ status: 'active' });

    await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'Public Chapter', start_ms: 0, end_ms: 5000 },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${book.id}/chapters`,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ chapters: Record<string, unknown>[] }>();
    assert.equal(body.chapters.length, 1);
    const ch = body.chapters[0]!;
    assert.equal(ch['status'], undefined, 'status must NOT be exposed in public chapter projection');
    assert.equal(ch['audio_object_key'], undefined, 'audio_object_key must NOT be exposed');
    assert.equal(ch['title'], 'Public Chapter');
    assert.equal(ch['start_ms'], 0);
    assert.equal(ch['end_ms'], 5000);
    assert.equal(ch['duration_ms'], 5000);
  });

  it('[14] editor receives full management chapter representation including status', async () => {
    const book = await seedBook({ status: 'active' });

    await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'Management Chapter', start_ms: 0, end_ms: 5000, status: 'approved' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ chapters: ManagementChapter[] }>();
    assert.equal(body.chapters[0]?.status, 'approved');
  });
});

// ─── 4. Management: Create & Update Books (RBAC) ──────────────────────────────
describe('POST & PATCH /api/v1/books', () => {
  it('[15] editor can create a book (201 Created)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Kulliyat-e-Iqbal',
        title_urdu: 'کلیات اقبال',
        author: 'Allama Iqbal',
        narrator_name: 'Zia Mohyeddin',
        language: 'ur',
        status: 'draft',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json<{ book: ManagementBook }>();
    assert.equal(body.book.title, 'Kulliyat-e-Iqbal');
    assert.equal(body.book.status, 'draft');
  });

  it('[16] admin can create a book (201 Created)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Diwan-e-Ghalib',
        title_urdu: 'دیوان غالب',
        author: 'Mirza Ghalib',
        narrator_name: 'Talat Hussain',
        language: 'ur',
      },
    });

    assert.equal(res.statusCode, 201);
  });

  it('[17] listener cannot create a book (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: { Authorization: `Bearer ${listenerToken}` },
      payload: {
        title: 'Unauthorized Book',
        title_urdu: 'غیر مجاز',
        author: 'Anon',
        narrator_name: 'Anon',
      },
    });

    assert.equal(res.statusCode, 403);
  });

  it('[18] narrator cannot create a book (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: { Authorization: `Bearer ${narratorToken}` },
      payload: {
        title: 'Narrator Book',
        title_urdu: 'راوی',
        author: 'Anon',
        narrator_name: 'Narrator User',
      },
    });

    assert.equal(res.statusCode, 403);
  });

  it('[19] unauthenticated request cannot create a book (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      payload: {
        title: 'No Auth Book',
        title_urdu: 'کوئی تصدیق نہیں',
        author: 'Anon',
        narrator_name: 'Anon',
      },
    });

    assert.equal(res.statusCode, 401);
  });

  it('[20] editor can update an existing book via PATCH', async () => {
    const book = await seedBook({ title: 'Original Title', price_cents: 1000 });

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${book.id}`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Updated Title',
        price_cents: 2000,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ book: ManagementBook }>();
    assert.equal(body.book.title, 'Updated Title');
    assert.equal(body.book.price_cents, 2000);
  });
});

// ─── 5. Management: Create & Update Chapters (Timing & Integrity) ────────────
describe('POST & PATCH /api/v1/books/:id/chapters', () => {
  it('[21] creates chapter with valid timing and automatically computes duration_ms', async () => {
    const book = await seedBook();

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        chapter_num: 1,
        title: 'Ibtida',
        title_urdu: 'ابتداء',
        start_ms: 0,
        end_ms: 125000,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json<{ chapter: ManagementChapter }>();
    assert.equal(body.chapter.chapter_num, 1);
    assert.equal(body.chapter.start_ms, 0);
    assert.equal(body.chapter.end_ms, 125000);
    assert.equal(body.chapter.duration_ms, 125000);
  });

  it('[22] rejects chapter creation on non-existent book ID (404)', async () => {
    const nonExistent = crypto.randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${nonExistent}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        chapter_num: 1,
        title: 'Orphan Chapter',
        start_ms: 0,
        end_ms: 1000,
      },
    });

    assert.equal(res.statusCode, 404);
  });

  it('[23] rejects duplicate chapter_num on same book with 409 Conflict', async () => {
    const book = await seedBook();

    await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'First Chapter', start_ms: 0, end_ms: 1000 },
    });

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'Duplicate Chapter Num', start_ms: 1000, end_ms: 2000 },
    });

    assert.equal(res.statusCode, 409);
  });

  it('[24] rejects invalid chapter timing where end_ms < start_ms (400)', async () => {
    const book = await seedBook();

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        chapter_num: 1,
        title: 'Invalid Timing',
        start_ms: 5000,
        end_ms: 2000, // Invalid!
      },
    });

    assert.equal(res.statusCode, 400);
  });

  it('[25] rejects invalid duration_ms if explicitly provided and mismatched (400)', async () => {
    const book = await seedBook();

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        chapter_num: 1,
        title: 'Mismatched Duration',
        start_ms: 0,
        end_ms: 5000,
        duration_ms: 9999, // Mismatched!
      },
    });

    assert.equal(res.statusCode, 400);
  });

  it('[26] updates chapter timing via PATCH and automatically recalculates duration_ms', async () => {
    const book = await seedBook();

    const createRes = await app.inject({
      method: 'POST',
      url: `${BASE}/${book.id}/chapters`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: { chapter_num: 1, title: 'Original Chapter', start_ms: 0, end_ms: 10000 },
    });
    const chapterId = createRes.json<{ chapter: ManagementChapter }>().chapter.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${book.id}/chapters/${chapterId}`,
      headers: { Authorization: `Bearer ${editorToken}` },
      payload: {
        end_ms: 15000,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json<{ chapter: ManagementChapter }>();
    assert.equal(body.chapter.start_ms, 0);
    assert.equal(body.chapter.end_ms, 15000);
    assert.equal(body.chapter.duration_ms, 15000);
  });
});
