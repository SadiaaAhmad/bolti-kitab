/**
 * Bolti Kitab — Real Audiobook Ingestion Pipeline Script
 *
 * Runs the full real-content ingestion flow for The Art of War Chapter 1:
 *   [1] User & Catalog setup (Book + Chapter)
 *   [2] Narrator initiates recording session
 *   [3] Upload token generated
 *   [4] Real audio file inspected server-side with audio-verifier
 *   [5] Storage upload simulated / performed
 *   [6] Take confirmed with authoritative inspected metadata
 *   [7] Editor reviews and approves take
 *   [8] Chapter updated with approved audio_object_key and completed session
 */

import path from 'node:path';
import fs from 'node:fs';
import { pool } from '../src/db/pool.js';
import { getStorageProvider } from '../src/storage/index.js';
import { inspectAudioFile } from '../src/modules/recordings/audio-verifier.js';
import * as recordingRepo from '../src/modules/recordings/repository.js';
import * as recordingService from '../src/modules/recordings/service.js';
import { createBook, createChapter } from '../src/modules/catalog/service.js';
import { hashPassword } from '../src/modules/auth/crypto.js';

export async function runRealIngestion(verbose = true) {
  const log = (msg: string, ...args: unknown[]) => {
    if (verbose) console.log(`[ingest] ${msg}`, ...args);
  };

  log('=== Starting Real Content Ingestion: The Art of War ===');

  // 1. Verify audio file on disk
  const audioFilePath = path.resolve(process.cwd(), '..', '.content_cache', 'artofwar_01_suntzu_64kb.mp3');
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found at ${audioFilePath}. Please download it first.`);
  }

  log('1. Inspecting real audio binary server-side...');
  const audioMeta = await inspectAudioFile(audioFilePath);
  log('   Inspected metadata:', JSON.stringify(audioMeta));

  // 2. Ensure test narrator and editor users exist
  const passwordHash = await hashPassword('SecureP@ss123!');

  const narratorRes = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, $2, 'Bob Neufeld', 'narrator', 'active')
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    ['bob.neufeld@librivox.test', passwordHash],
  );
  const narratorId = narratorRes.rows[0]!.id;

  const editorRes = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, $2, 'Lead Editor', 'editor', 'active')
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    ['editor@boltikitab.test', passwordHash],
  );
  const editorId = editorRes.rows[0]!.id;

  log(`2. Users ready (Narrator: ${narratorId}, Editor: ${editorId})`);

  // 3. Create or find Book
  let bookId: string;
  const existingBook = await pool.query<{ id: string }>(
    "SELECT id FROM books WHERE title = 'The Art of War' LIMIT 1",
  );
  if (existingBook.rows.length > 0) {
    bookId = existingBook.rows[0]!.id;
    log(`3. Book found: The Art of War (${bookId})`);
  } else {
    const book = await createBook({
      title: 'The Art of War',
      title_urdu: 'فنِ حرب',
      author: 'Sun Tzu',
      narrator_name: 'Bob Neufeld',
      language: 'en',
      status: 'active',
      price_cents: 0,
      duration_seconds: Math.round(audioMeta.duration_ms / 1000),
      published_at: new Date().toISOString(),
    });
    bookId = book.id;
    log(`3. Created Book: The Art of War (${bookId})`);
  }

  // 4. Create or find Chapter 1
  let chapterId: string;
  const existingChapter = await pool.query<{ id: string }>(
    'SELECT id FROM chapters WHERE book_id = $1 AND chapter_num = 1 LIMIT 1',
    [bookId],
  );
  if (existingChapter.rows.length > 0) {
    chapterId = existingChapter.rows[0]!.id;
    log(`4. Chapter 1 found (${chapterId})`);
  } else {
    const chapter = await createChapter(bookId, {
      chapter_num: 1,
      title: 'Part 1: Laying Plans & Waging War',
      title_urdu: 'حصہ اول: منصوبہ بندی اور جنگ',
      start_ms: 18200,
      end_ms: audioMeta.duration_ms,
      duration_ms: audioMeta.duration_ms - 18200,
      is_preview_free: true,
    });
    chapterId = chapter.id;
    log(`4. Created Chapter 1 (${chapterId})`);
  }

  // 5. Narrator initiates recording session
  const session = await recordingService.createSession({
    narratorId,
    bookId,
    chapterId,
    notes: 'Studio ingestion of LibriVox master take for Chapter 1.',
  });
  log(`5. Recording Session created (${session.id})`);

  // 6. Request upload authorization token
  const uploadToken = await recordingService.generateUploadToken(session.id, narratorId, 'narrator');
  log(`6. Upload authorization issued: blob_key = ${uploadToken.blob_key}`);

  // 7. Store audio in Storage Provider
  const storage = getStorageProvider();
  if ('uploadFile' in storage && typeof storage.uploadFile === 'function') {
    log('7. Uploading real MP3 binary to Storage Provider...');
    await storage.uploadFile(uploadToken.blob_key, audioFilePath, 'audio/mpeg');
    log('   Real audio uploaded to Storage Provider successfully');
  } else if ('simulateUpload' in storage) {
    // If using mock provider
    (storage as { simulateUpload: (k: string) => void }).simulateUpload(uploadToken.blob_key);
    log('7. Audio upload simulated in Mock Storage Provider');
  }

  // 8. Confirm take using inspected metadata
  const take = await recordingService.confirmTake(uploadToken.recording_id, narratorId, 'narrator', {
    duration_ms: audioMeta.duration_ms,
    file_size_bytes: audioMeta.file_size_bytes,
    sample_rate_hz: audioMeta.sample_rate_hz,
    channels: audioMeta.channels,
  });
  log(`8. Take confirmed (status: ${take.status})`);

  // 9. Editor approves take
  const approvedTake = await recordingService.approveTake(take.id, editorId);
  log(`9. Editor approved take (status: ${approvedTake.status})`);

  // 10. Verify chapter association
  const verifiedChapter = await pool.query<{
    id: string;
    audio_object_key: string | null;
    status: string;
  }>('SELECT id, audio_object_key, status FROM chapters WHERE id = $1', [chapterId]);

  log('10. Chapter status after approval:', JSON.stringify(verifiedChapter.rows[0]));

  return {
    bookId,
    chapterId,
    sessionId: session.id,
    recordingId: take.id,
    blobKey: uploadToken.blob_key,
    audioMeta,
  };
}

// Direct execution
if (process.argv[1]?.endsWith('ingest-real-audio.ts') || process.argv[1]?.endsWith('ingest-real-audio.js')) {
  runRealIngestion()
    .then((res) => {
      console.log('\n[SUCCESS] Real content ingested successfully!');
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[ERROR] Ingestion failed:', err);
      process.exit(1);
    });
}
