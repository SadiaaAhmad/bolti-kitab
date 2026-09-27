/**
 * Bolti Kitab — Ingestion Pipeline for The Art of War Chapter 2 (Part 2)
 */

import path from 'node:path';
import fs from 'node:fs';
import { pool } from '../src/db/pool.js';
import { getStorageProvider } from '../src/storage/index.js';
import { inspectAudioFile } from '../src/modules/recordings/audio-verifier.js';
import * as recordingService from '../src/modules/recordings/service.js';
import { createChapter } from '../src/modules/catalog/service.js';
import { hashPassword } from '../src/modules/auth/crypto.js';

export async function runIngestPart2(verbose = true) {
  const log = (msg: string, ...args: unknown[]) => {
    if (verbose) console.log(`[ingest-part2] ${msg}`, ...args);
  };

  log('=== Ingesting The Art of War Part 2 ===');

  const audioFilePath = path.resolve(process.cwd(), '..', '.content_cache', 'artofwar_02_suntzu_64kb.mp3');
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found at ${audioFilePath}.`);
  }

  log('1. Inspecting Part 2 audio file server-side...');
  const audioMeta = await inspectAudioFile(audioFilePath);
  log('   Inspected metadata:', JSON.stringify(audioMeta));

  // Find users
  const narratorRes = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'bob.neufeld@librivox.test' LIMIT 1"
  );
  let narratorId = narratorRes.rows[0]?.id;
  if (!narratorId) {
    const passwordHash = await hashPassword('SecureP@ss123!');
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ('bob.neufeld@librivox.test', $1, 'Bob Neufeld', 'narrator', 'active')
       RETURNING id`,
      [passwordHash]
    );
    narratorId = ins.rows[0]!.id;
  }

  const editorRes = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'editor@boltikitab.test' LIMIT 1"
  );
  let editorId = editorRes.rows[0]?.id;
  if (!editorId) {
    const passwordHash = await hashPassword('SecureP@ss123!');
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ('editor@boltikitab.test', $1, 'Lead Editor', 'editor', 'active')
       RETURNING id`,
      [passwordHash]
    );
    editorId = ins.rows[0]!.id;
  }

  // Find book
  const bookRes = await pool.query<{ id: string }>(
    "SELECT id FROM books WHERE title = 'The Art of War' LIMIT 1"
  );
  if (bookRes.rows.length === 0) {
    throw new Error('Book "The Art of War" not found in database');
  }
  const bookId = bookRes.rows[0]!.id;

  // Create or find Chapter 2
  let chapterId: string;
  const existingChapter = await pool.query<{ id: string }>(
    'SELECT id FROM chapters WHERE book_id = $1 AND chapter_num = 2 LIMIT 1',
    [bookId]
  );
  if (existingChapter.rows.length > 0) {
    chapterId = existingChapter.rows[0]!.id;
    log(`2. Chapter 2 already exists (${chapterId})`);
  } else {
    const chapter = await createChapter(bookId, {
      chapter_num: 2,
      title: 'Part 2: The Army on the March & Terrain',
      title_urdu: 'حصہ دوم: فوج کی پیش قدمی اور میدانِ جنگ',
      start_ms: 6400,
      end_ms: audioMeta.duration_ms,
      duration_ms: audioMeta.duration_ms - 6400,
      is_preview_free: true,
    });
    chapterId = chapter.id;
    log(`2. Created Chapter 2 (${chapterId})`);
  }

  // Recording session
  const session = await recordingService.createSession({
    narratorId,
    bookId,
    chapterId,
    notes: 'Studio ingestion of LibriVox master take for Part 2.',
  });
  log(`3. Recording Session created (${session.id})`);

  // Upload token
  const uploadToken = await recordingService.generateUploadToken(session.id, narratorId, 'narrator');
  log(`4. Upload authorization issued: blob_key = ${uploadToken.blob_key}`);

  // Upload to Storage Provider
  const storage = getStorageProvider();
  if ('uploadFile' in storage && typeof storage.uploadFile === 'function') {
    log('5. Uploading Part 2 MP3 binary to Storage Provider (B2)...');
    await storage.uploadFile(uploadToken.blob_key, audioFilePath, 'audio/mpeg');
    log('   Part 2 uploaded to Storage Provider successfully');
  } else if ('simulateUpload' in storage) {
    (storage as { simulateUpload: (k: string) => void }).simulateUpload(uploadToken.blob_key);
    log('5. Simulated upload in Mock Storage Provider');
  }

  // Confirm take
  const take = await recordingService.confirmTake(uploadToken.recording_id, narratorId, 'narrator', {
    duration_ms: audioMeta.duration_ms,
    file_size_bytes: audioMeta.file_size_bytes,
    sample_rate_hz: audioMeta.sample_rate_hz,
    channels: audioMeta.channels,
  });
  log(`6. Take confirmed (${take.status})`);

  // Editor approves take
  const approvedTake = await recordingService.approveTake(take.id, editorId);
  log(`7. Editor approved take (${approvedTake.status})`);

  // Update book total duration
  const totalDurRes = await pool.query<{ total: string }>(
    'SELECT SUM(duration_ms) as total FROM chapters WHERE book_id = $1',
    [bookId]
  );
  const totalDurationSec = Math.round(parseInt(totalDurRes.rows[0]?.total ?? '0', 10) / 1000);
  await pool.query('UPDATE books SET duration_seconds = $1 WHERE id = $2', [totalDurationSec, bookId]);
  log(`8. Updated book total duration to ${totalDurationSec}s (${Math.round(totalDurationSec / 60)} mins)`);

  const chaptersRes = await pool.query<{ chapter_num: number; title: string; duration_ms: number; status: string }>(
    'SELECT chapter_num, title, duration_ms, status FROM chapters WHERE book_id = $1 ORDER BY chapter_num ASC',
    [bookId]
  );
  log('9. Chapters currently in catalog for The Art of War:');
  for (const c of chaptersRes.rows) {
    log(`   - Chapter ${c.chapter_num}: ${c.title} (${Math.round(c.duration_ms / 1000)}s) [${c.status}]`);
  }

  return { bookId, chapterId };
}

if (process.argv[1]?.endsWith('ingest-chapter-2.ts') || process.argv[1]?.endsWith('ingest-chapter-2.js')) {
  runIngestPart2(true)
    .then(() => {
      console.log('[ingest-part2] Ingestion completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ingest-part2] Ingestion failed:', err);
      process.exit(1);
    });
}
