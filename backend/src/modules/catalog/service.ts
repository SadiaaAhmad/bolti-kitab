/**
 * Bolti Kitab — Catalog Service
 *
 * Business logic, role-aware security constraints, chapter timeline verification,
 * and safe projections for books and chapters.
 */

import type { UserRole } from '../auth/types.js';
import * as catalogRepo from './repository.js';
import type {
  BookRow,
  ChapterRow,
  PublicBook,
  ManagementBook,
  PublicChapter,
  ManagementChapter,
  ListBooksQuery,
  PaginatedBooksResult,
  CreateBookInput,
  UpdateBookInput,
  CreateChapterInput,
  UpdateChapterInput,
  BookStatus,
} from './types.js';

// ─── Projection Helpers ───────────────────────────────────────────────────────

export function toPublicBook(row: BookRow): PublicBook {
  return {
    id: row.id,
    title: row.title,
    title_urdu: row.title_urdu,
    author: row.author,
    narrator_name: row.narrator_name,
    synopsis: row.synopsis,
    language: row.language,
    duration_seconds: row.duration_seconds,
    price_cents: row.price_cents,
    currency: row.currency,
    cover_object_key: row.cover_object_key,
    status: 'active',
    published_at: row.published_at ? row.published_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toManagementBook(row: BookRow): ManagementBook {
  return {
    id: row.id,
    title: row.title,
    title_urdu: row.title_urdu,
    author: row.author,
    narrator_name: row.narrator_name,
    synopsis: row.synopsis,
    language: row.language,
    duration_seconds: row.duration_seconds,
    price_cents: row.price_cents,
    currency: row.currency,
    cover_object_key: row.cover_object_key,
    status: row.status,
    published_at: row.published_at ? row.published_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Public chapter projection: strictly omits `status` and `audio_object_key`
 * to protect internal production workflow and private storage references.
 */
export function toPublicChapter(row: ChapterRow): PublicChapter {
  return {
    id: row.id,
    book_id: row.book_id,
    chapter_num: row.chapter_num,
    title: row.title,
    title_urdu: row.title_urdu,
    start_ms: row.start_ms,
    end_ms: row.end_ms,
    duration_ms: row.duration_ms,
    is_preview_free: row.is_preview_free,
  };
}

export function toManagementChapter(row: ChapterRow): ManagementChapter {
  return {
    id: row.id,
    book_id: row.book_id,
    chapter_num: row.chapter_num,
    title: row.title,
    title_urdu: row.title_urdu,
    start_ms: row.start_ms,
    end_ms: row.end_ms,
    duration_ms: row.duration_ms,
    is_preview_free: row.is_preview_free,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

// ─── Books Service ────────────────────────────────────────────────────────────

export async function listBooks(
  query: ListBooksQuery,
  userRole?: UserRole,
): Promise<PaginatedBooksResult<PublicBook | ManagementBook>> {
  const rawPage = typeof query.page === 'string' ? parseInt(query.page, 10) : (query.page ?? 1);
  const rawLimit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : (query.limit ?? 20);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit));

  const isPrivileged = userRole === 'editor' || userRole === 'admin';

  // SECURITY INVARIANT:
  // Unauthenticated users and listeners are ALWAYS restricted to active books.
  // Never allow listener or unauthenticated requests to discover unpublished books,
  // regardless of what `status` query parameter was passed.
  let effectiveStatus: BookStatus | undefined = 'active';
  if (isPrivileged) {
    effectiveStatus = query.status; // May be undefined (all) or specific status
  }

  const { rows, total } = await catalogRepo.findBooks({
    page,
    limit,
    language: query.language,
    status: effectiveStatus,
    search: query.search,
  });

  const totalPages = Math.ceil(total / limit);

  const books = isPrivileged
    ? rows.map(toManagementBook)
    : rows.map(toPublicBook);

  return {
    books,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
    },
  };
}

export async function getBookById(
  id: string,
  userRole?: UserRole,
): Promise<PublicBook | ManagementBook> {
  const book = await catalogRepo.findBookById(id);
  if (!book) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  const isPrivileged = userRole === 'editor' || userRole === 'admin';

  // Non-privileged callers cannot discover non-active books
  if (!isPrivileged && book.status !== 'active') {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  return isPrivileged ? toManagementBook(book) : toPublicBook(book);
}

export async function createBook(input: CreateBookInput): Promise<ManagementBook> {
  // If status is active and published_at is not provided, set to now
  const publishedAt =
    input.status === 'active' && !input.published_at
      ? new Date().toISOString()
      : input.published_at ?? null;

  const book = await catalogRepo.insertBook({
    ...input,
    published_at: publishedAt,
  });

  return toManagementBook(book);
}

export async function updateBook(
  id: string,
  input: UpdateBookInput,
): Promise<ManagementBook> {
  const existing = await catalogRepo.findBookById(id);
  if (!existing) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  // If status is transitioning to active and published_at is unset, set to now
  let publishedAt = input.published_at;
  if (input.status === 'active' && !existing.published_at && !input.published_at) {
    publishedAt = new Date().toISOString();
  }

  const updated = await catalogRepo.updateBook(id, {
    ...input,
    published_at: publishedAt,
  });

  if (!updated) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  return toManagementBook(updated);
}

// ─── Chapters Service ─────────────────────────────────────────────────────────

export async function listChapters(
  bookId: string,
  userRole?: UserRole,
): Promise<{ chapters: Array<PublicChapter | ManagementChapter> }> {
  const book = await catalogRepo.findBookById(bookId);
  if (!book) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  const isPrivileged = userRole === 'editor' || userRole === 'admin';

  // Public callers cannot access chapters of unpublished books
  if (!isPrivileged && book.status !== 'active') {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  const rows = await catalogRepo.findChaptersByBookId(bookId);

  const chapters = isPrivileged
    ? rows.map(toManagementChapter)
    : rows.map(toPublicChapter);

  return { chapters };
}

export async function createChapter(
  bookId: string,
  input: CreateChapterInput,
): Promise<ManagementChapter> {
  const book = await catalogRepo.findBookById(bookId);
  if (!book) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  const startMs = input.start_ms ?? 0;
  const endMs = input.end_ms ?? 0;

  if (endMs < startMs) {
    const err = new Error('Chapter end_ms must be greater than or equal to start_ms.');
    (err as NodeJS.ErrnoException).code = 'TIMING_INVALID';
    throw err;
  }

  const calculatedDuration = endMs - startMs;
  if (input.duration_ms !== undefined && input.duration_ms !== calculatedDuration) {
    const err = new Error(
      `duration_ms (${input.duration_ms}) must equal end_ms - start_ms (${calculatedDuration}).`,
    );
    (err as NodeJS.ErrnoException).code = 'TIMING_INVALID';
    throw err;
  }

  try {
    const chapter = await catalogRepo.insertChapter(bookId, {
      ...input,
      start_ms: startMs,
      end_ms: endMs,
      duration_ms: calculatedDuration,
    });
    return toManagementChapter(chapter);
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { constraint?: string };
    if (error.code === '23505' && error.constraint === 'uq_book_chapter_num') {
      const duplicateErr = new Error(
        `Chapter number ${input.chapter_num} already exists for this book.`,
      );
      (duplicateErr as NodeJS.ErrnoException).code = 'DUPLICATE_CHAPTER_NUM';
      throw duplicateErr;
    }
    throw err;
  }
}

export async function updateChapter(
  bookId: string,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<ManagementChapter> {
  const book = await catalogRepo.findBookById(bookId);
  if (!book) {
    const err = new Error('Book not found.');
    (err as NodeJS.ErrnoException).code = 'BOOK_NOT_FOUND';
    throw err;
  }

  const existing = await catalogRepo.findChapterById(bookId, chapterId);
  if (!existing) {
    const err = new Error('Chapter not found.');
    (err as NodeJS.ErrnoException).code = 'CHAPTER_NOT_FOUND';
    throw err;
  }

  const newStartMs = input.start_ms !== undefined ? input.start_ms : existing.start_ms;
  const newEndMs = input.end_ms !== undefined ? input.end_ms : existing.end_ms;

  if (newEndMs < newStartMs) {
    const err = new Error('Chapter end_ms must be greater than or equal to start_ms.');
    (err as NodeJS.ErrnoException).code = 'TIMING_INVALID';
    throw err;
  }

  const calculatedDuration = newEndMs - newStartMs;
  if (input.duration_ms !== undefined && input.duration_ms !== calculatedDuration) {
    const err = new Error(
      `duration_ms (${input.duration_ms}) must equal end_ms - start_ms (${calculatedDuration}).`,
    );
    (err as NodeJS.ErrnoException).code = 'TIMING_INVALID';
    throw err;
  }

  try {
    const updated = await catalogRepo.updateChapter(bookId, chapterId, {
      ...input,
      start_ms: newStartMs,
      end_ms: newEndMs,
      duration_ms: calculatedDuration,
    });

    if (!updated) {
      const err = new Error('Chapter not found.');
      (err as NodeJS.ErrnoException).code = 'CHAPTER_NOT_FOUND';
      throw err;
    }

    return toManagementChapter(updated);
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { constraint?: string };
    if (error.code === '23505' && error.constraint === 'uq_book_chapter_num') {
      const duplicateErr = new Error(
        `Chapter number ${input.chapter_num} already exists for this book.`,
      );
      (duplicateErr as NodeJS.ErrnoException).code = 'DUPLICATE_CHAPTER_NUM';
      throw duplicateErr;
    }
    throw err;
  }
}
