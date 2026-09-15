/**
 * Bolti Kitab — Catalog Repository
 *
 * Direct database access layer for books and chapters using parameterized SQL queries.
 */

import { pool } from '../../db/pool.js';
import type {
  BookRow,
  ChapterRow,
  BookLanguage,
  BookStatus,
  CreateBookInput,
  UpdateBookInput,
  CreateChapterInput,
  UpdateChapterInput,
} from './types.js';

export interface FindBooksOptions {
  page: number;
  limit: number;
  language?: BookLanguage | undefined;
  status?: BookStatus | undefined;
  search?: string | undefined;
}

export interface FindBooksResult {
  rows: BookRow[];
  total: number;
}

// ─── SQL Escape Helper for LIKE Search ────────────────────────────────────────
function escapeLikePattern(input: string): string {
  return input.replace(/([%_\\])/g, '\\$1');
}

export async function findBooks(options: FindBooksOptions): Promise<FindBooksResult> {
  const { page, limit, language, status, search } = options;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (status !== undefined) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(status);
  }

  if (language !== undefined) {
    conditions.push(`language = $${paramIndex++}`);
    values.push(language);
  }

  if (search !== undefined && search.trim() !== '') {
    const escaped = escapeLikePattern(search.trim());
    conditions.push(`(title ILIKE $${paramIndex} OR title_urdu ILIKE $${paramIndex})`);
    values.push(`%${escaped}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching rows
  const countSql = `SELECT COUNT(*)::int AS total FROM books ${whereClause}`;
  const countResult = await pool.query<{ total: number }>(countSql, values);
  const total = countResult.rows[0]?.total ?? 0;

  // Retrieve paginated rows
  const dataValues = [...values, limit, offset];
  const dataSql = `
    SELECT id, title, title_urdu, author, narrator_name, synopsis,
           language, duration_seconds, price_cents, currency,
           cover_object_key, status, published_at, created_at, updated_at
      FROM books
     ${whereClause}
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const dataResult = await pool.query<BookRow>(dataSql, dataValues);
  return { rows: dataResult.rows, total };
}

export async function findBookById(id: string): Promise<BookRow | null> {
  const sql = `
    SELECT id, title, title_urdu, author, narrator_name, synopsis,
           language, duration_seconds, price_cents, currency,
           cover_object_key, status, published_at, created_at, updated_at
      FROM books
     WHERE id = $1
     LIMIT 1
  `;
  const result = await pool.query<BookRow>(sql, [id]);
  return result.rows[0] ?? null;
}

export async function insertBook(data: CreateBookInput): Promise<BookRow> {
  const sql = `
    INSERT INTO books (
      title, title_urdu, author, narrator_name, synopsis,
      language, duration_seconds, price_cents, currency,
      cover_object_key, status, published_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12
    )
    RETURNING id, title, title_urdu, author, narrator_name, synopsis,
              language, duration_seconds, price_cents, currency,
              cover_object_key, status, published_at, created_at, updated_at
  `;

  const values = [
    data.title,
    data.title_urdu,
    data.author,
    data.narrator_name,
    data.synopsis ?? null,
    data.language ?? 'ur',
    data.duration_seconds ?? 0,
    data.price_cents ?? 0,
    data.currency ?? 'PKR',
    data.cover_object_key ?? null,
    data.status ?? 'draft',
    data.published_at ? new Date(data.published_at) : null,
  ];

  const result = await pool.query<BookRow>(sql, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Book insertion failed unexpectedly.');
  }
  return row;
}

export async function updateBook(id: string, data: UpdateBookInput): Promise<BookRow | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    assignments.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.title_urdu !== undefined) {
    assignments.push(`title_urdu = $${paramIndex++}`);
    values.push(data.title_urdu);
  }
  if (data.author !== undefined) {
    assignments.push(`author = $${paramIndex++}`);
    values.push(data.author);
  }
  if (data.narrator_name !== undefined) {
    assignments.push(`narrator_name = $${paramIndex++}`);
    values.push(data.narrator_name);
  }
  if (data.synopsis !== undefined) {
    assignments.push(`synopsis = $${paramIndex++}`);
    values.push(data.synopsis);
  }
  if (data.language !== undefined) {
    assignments.push(`language = $${paramIndex++}`);
    values.push(data.language);
  }
  if (data.duration_seconds !== undefined) {
    assignments.push(`duration_seconds = $${paramIndex++}`);
    values.push(data.duration_seconds);
  }
  if (data.price_cents !== undefined) {
    assignments.push(`price_cents = $${paramIndex++}`);
    values.push(data.price_cents);
  }
  if (data.currency !== undefined) {
    assignments.push(`currency = $${paramIndex++}`);
    values.push(data.currency);
  }
  if (data.cover_object_key !== undefined) {
    assignments.push(`cover_object_key = $${paramIndex++}`);
    values.push(data.cover_object_key);
  }
  if (data.status !== undefined) {
    assignments.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.published_at !== undefined) {
    assignments.push(`published_at = $${paramIndex++}`);
    values.push(data.published_at ? new Date(data.published_at) : null);
  }

  if (assignments.length === 0) {
    return findBookById(id);
  }

  assignments.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const sql = `
    UPDATE books
       SET ${assignments.join(', ')}
     WHERE id = $${paramIndex}
    RETURNING id, title, title_urdu, author, narrator_name, synopsis,
              language, duration_seconds, price_cents, currency,
              cover_object_key, status, published_at, created_at, updated_at
  `;

  const result = await pool.query<BookRow>(sql, values);
  return result.rows[0] ?? null;
}

export async function findChaptersByBookId(bookId: string): Promise<ChapterRow[]> {
  const sql = `
    SELECT id, book_id, chapter_num, title, title_urdu,
           start_ms, end_ms, duration_ms, audio_object_key,
           is_preview_free, status, created_at, updated_at
      FROM chapters
     WHERE book_id = $1
     ORDER BY chapter_num ASC
  `;
  const result = await pool.query<ChapterRow>(sql, [bookId]);
  return result.rows;
}

export async function findChapterById(bookId: string, chapterId: string): Promise<ChapterRow | null> {
  const sql = `
    SELECT id, book_id, chapter_num, title, title_urdu,
           start_ms, end_ms, duration_ms, audio_object_key,
           is_preview_free, status, created_at, updated_at
      FROM chapters
     WHERE book_id = $1 AND id = $2
     LIMIT 1
  `;
  const result = await pool.query<ChapterRow>(sql, [bookId, chapterId]);
  return result.rows[0] ?? null;
}

export async function insertChapter(
  bookId: string,
  data: CreateChapterInput & { duration_ms: number },
): Promise<ChapterRow> {
  const sql = `
    INSERT INTO chapters (
      book_id, chapter_num, title, title_urdu,
      start_ms, end_ms, duration_ms,
      is_preview_free, status
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9
    )
    RETURNING id, book_id, chapter_num, title, title_urdu,
              start_ms, end_ms, duration_ms, audio_object_key,
              is_preview_free, status, created_at, updated_at
  `;

  const values = [
    bookId,
    data.chapter_num,
    data.title,
    data.title_urdu ?? null,
    data.start_ms ?? 0,
    data.end_ms ?? 0,
    data.duration_ms,
    data.is_preview_free ?? false,
    data.status ?? 'pending',
  ];

  const result = await pool.query<ChapterRow>(sql, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error('Chapter insertion failed unexpectedly.');
  }
  return row;
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  data: UpdateChapterInput & { duration_ms?: number },
): Promise<ChapterRow | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.chapter_num !== undefined) {
    assignments.push(`chapter_num = $${paramIndex++}`);
    values.push(data.chapter_num);
  }
  if (data.title !== undefined) {
    assignments.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.title_urdu !== undefined) {
    assignments.push(`title_urdu = $${paramIndex++}`);
    values.push(data.title_urdu);
  }
  if (data.start_ms !== undefined) {
    assignments.push(`start_ms = $${paramIndex++}`);
    values.push(data.start_ms);
  }
  if (data.end_ms !== undefined) {
    assignments.push(`end_ms = $${paramIndex++}`);
    values.push(data.end_ms);
  }
  if (data.duration_ms !== undefined) {
    assignments.push(`duration_ms = $${paramIndex++}`);
    values.push(data.duration_ms);
  }
  if (data.is_preview_free !== undefined) {
    assignments.push(`is_preview_free = $${paramIndex++}`);
    values.push(data.is_preview_free);
  }
  if (data.status !== undefined) {
    assignments.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }

  if (assignments.length === 0) {
    return findChapterById(bookId, chapterId);
  }

  assignments.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(bookId);
  const bookIdParam = paramIndex++;
  values.push(chapterId);
  const chapterIdParam = paramIndex++;

  const sql = `
    UPDATE chapters
       SET ${assignments.join(', ')}
     WHERE book_id = $${bookIdParam} AND id = $${chapterIdParam}
    RETURNING id, book_id, chapter_num, title, title_urdu,
              start_ms, end_ms, duration_ms, audio_object_key,
              is_preview_free, status, created_at, updated_at
  `;

  const result = await pool.query<ChapterRow>(sql, values);
  return result.rows[0] ?? null;
}
