/**
 * Bolti Kitab — Catalog Types & Domain Models
 *
 * Defines domain entities, database row interfaces, and DTOs for books and chapters.
 */

import type { UserRole } from '../auth/types.js';

export type BookLanguage = 'ur' | 'en' | 'pa' | 'sd';
export type BookStatus = 'draft' | 'in_recording' | 'in_review' | 'active' | 'archived';
export type ChapterStatus = 'pending' | 'recorded' | 'approved' | 'rejected';

// ─── Raw Database Rows ────────────────────────────────────────────────────────
export interface BookRow {
  id: string;
  title: string;
  title_urdu: string;
  author: string;
  narrator_name: string;
  synopsis: string | null;
  language: BookLanguage;
  duration_seconds: number;
  price_cents: number;
  currency: string;
  cover_object_key: string | null;
  status: BookStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChapterRow {
  id: string;
  book_id: string;
  chapter_num: number;
  title: string;
  title_urdu: string | null;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  audio_object_key: string | null;
  is_preview_free: boolean;
  status: ChapterStatus;
  created_at: Date;
  updated_at: Date;
}

// ─── Public & Management Projections ──────────────────────────────────────────
export interface PublicBook {
  id: string;
  title: string;
  title_urdu: string;
  author: string;
  narrator_name: string;
  synopsis: string | null;
  language: BookLanguage;
  duration_seconds: number;
  price_cents: number;
  currency: string;
  cover_object_key: string | null;
  status: 'active';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagementBook {
  id: string;
  title: string;
  title_urdu: string;
  author: string;
  narrator_name: string;
  synopsis: string | null;
  language: BookLanguage;
  duration_seconds: number;
  price_cents: number;
  currency: string;
  cover_object_key: string | null;
  status: BookStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Public chapter projection for listeners & storefront.
 * STRICT SECURITY INVARIANT:
 * Omits `status` and `audio_object_key` to avoid exposing internal production
 * workflow state or private object storage references.
 */
export interface PublicChapter {
  id: string;
  book_id: string;
  chapter_num: number;
  title: string;
  title_urdu: string | null;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  is_preview_free: boolean;
}

/**
 * Management chapter representation for editors & admins.
 */
export interface ManagementChapter extends PublicChapter {
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedBooksResult<T> {
  books: T[];
  pagination: PaginationMetadata;
}

// ─── Query & Mutation Inputs ──────────────────────────────────────────────────
export interface ListBooksQuery {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  language?: BookLanguage | undefined;
  status?: BookStatus | undefined;
  search?: string | undefined;
}

export interface ListBooksFilter extends ListBooksQuery {
  userRole?: UserRole | undefined;
}

export interface CreateBookInput {
  title: string;
  title_urdu: string;
  author: string;
  narrator_name: string;
  synopsis?: string | null | undefined;
  language?: BookLanguage | undefined;
  duration_seconds?: number | undefined;
  price_cents?: number | undefined;
  currency?: string | undefined;
  cover_object_key?: string | null | undefined;
  status?: BookStatus | undefined;
  published_at?: string | null | undefined;
}

export interface UpdateBookInput {
  title?: string | undefined;
  title_urdu?: string | undefined;
  author?: string | undefined;
  narrator_name?: string | undefined;
  synopsis?: string | null | undefined;
  language?: BookLanguage | undefined;
  duration_seconds?: number | undefined;
  price_cents?: number | undefined;
  currency?: string | undefined;
  cover_object_key?: string | null | undefined;
  status?: BookStatus | undefined;
  published_at?: string | null | undefined;
}

export interface CreateChapterInput {
  chapter_num: number;
  title: string;
  title_urdu?: string | null | undefined;
  start_ms?: number | undefined;
  end_ms?: number | undefined;
  duration_ms?: number | undefined;
  is_preview_free?: boolean | undefined;
  status?: ChapterStatus | undefined;
}

export interface UpdateChapterInput {
  chapter_num?: number | undefined;
  title?: string | undefined;
  title_urdu?: string | null | undefined;
  start_ms?: number | undefined;
  end_ms?: number | undefined;
  duration_ms?: number | undefined;
  is_preview_free?: boolean | undefined;
  status?: ChapterStatus | undefined;
}
