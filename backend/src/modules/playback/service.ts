/**
 * Bolti Kitab — Playback Service
 *
 * Coordinates playback authorization, entitlement verification,
 * short-lived presigned stream URL generation, and listening progress.
 *
 * KEY RULES:
 *   - Heavy audio binaries are NEVER proxied through the backend.
 *   - Download SAS URLs are scoped to a single object with short TTL.
 *   - Access requires an active entitlement, free preview chapter, or editor/admin role.
 *   - Only chapters in 'approved' status with an audio_object_key can be played.
 */

import { config } from '../../config/env.js';
import { getStorageProvider } from '../../storage/index.js';
import * as repo from './repository.js';
import type {
  BookPlaybackOverview,
  PlaybackTokenResponse,
  ListeningProgressDto,
  UpdateProgressInput,
} from './types.js';

export async function getPlaybackOverview(
  userId: string,
  userRole: string,
  bookId: string,
): Promise<BookPlaybackOverview> {
  const book = await repo.findBookForPlayback(bookId);
  if (!book) {
    const err = new Error('Book not found.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  if (book.status !== 'active' && userRole !== 'editor' && userRole !== 'admin') {
    const err = new Error('Book is not published.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const isEntitled =
    userRole === 'admin' ||
    userRole === 'editor' ||
    (await repo.checkUserEntitlement(userId, bookId));

  const chapters = await repo.findChaptersForPlayback(bookId);
  const progress = await repo.findListeningProgress(userId, bookId);

  return {
    book_id: book.id,
    title: book.title,
    title_urdu: book.title_urdu,
    is_entitled: isEntitled,
    chapters,
    progress,
  };
}

export async function getChapterPlaybackToken(
  userId: string,
  userRole: string,
  bookId: string,
  chapterId: string,
): Promise<PlaybackTokenResponse> {
  const chapter = await repo.findChapterForPlayback(bookId, chapterId);
  if (!chapter) {
    const err = new Error('Chapter not found for this book.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  if (chapter.status !== 'approved' || !chapter.audio_object_key) {
    const err = new Error(
      'Audio for this chapter is not yet approved for playback.',
    ) as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  // Authorization check: preview-free, editor/admin, or active entitlement
  const isAuthorized =
    chapter.is_preview_free ||
    userRole === 'editor' ||
    userRole === 'admin' ||
    (await repo.checkUserEntitlement(userId, bookId));

  if (!isAuthorized) {
    const err = new Error(
      'Subscription or purchase required to listen to this chapter.',
    ) as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  const storage = getStorageProvider();
  const ttl = config.storage.playbackTtlSeconds;
  const auth = await storage.generateDownloadUrl(chapter.audio_object_key, ttl);

  const format = chapter.audio_object_key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

  return {
    book_id: chapter.book_id,
    chapter_id: chapter.id,
    chapter_num: chapter.chapter_num,
    title: chapter.title,
    title_urdu: chapter.title_urdu,
    start_ms: chapter.start_ms,
    duration_ms: chapter.duration_ms,
    playback_url: auth.download_url,
    expires_at: auth.expires_at,
    format,
  };
}

export async function getListeningProgress(
  userId: string,
  bookId: string,
): Promise<ListeningProgressDto | null> {
  return repo.findListeningProgress(userId, bookId);
}

export async function saveListeningProgress(
  userId: string,
  bookId: string,
  input: UpdateProgressInput,
): Promise<ListeningProgressDto> {
  const chapter = await repo.findChapterForPlayback(bookId, input.chapter_id);
  if (!chapter) {
    const err = new Error('Chapter not found for this book.') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  return repo.upsertListeningProgress(userId, bookId, input);
}
