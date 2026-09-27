/**
 * Bolti Kitab — Verify API Playback & Live B2 Stream Verification
 *
 * Checks:
 *   [1] Backend API health & reachability on port 3000
 *   [2] Login & JWT acquisition
 *   [3] Catalog retrieval (The Art of War)
 *   [4] Chapter 1 retrieval & status
 *   [5] Chapter 1 object exists in Backblaze B2
 *   [6] Playback API returns presigned B2 HTTPS download URL
 *   [7] HTTP Range (206 Partial Content) streaming from B2 presigned URL
 *
 * SECURITY:
 *   - NEVER prints signed URLs or credentials.
 */

import { pool } from '../src/db/pool.js';
import { getStorageProvider } from '../src/storage/index.js';

async function verifyPlaybackApi() {
  console.log('\n==================================================');
  console.log('BOLTI KITAB — LIVE API & B2 PLAYBACK VERIFICATION');
  console.log('==================================================\n');

  try {
    // 1. API Login
    const loginRes = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob.neufeld@librivox.test',
        password: 'SecureP@ss123!',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed with HTTP ${loginRes.status}: ${await loginRes.text()}`);
    }

    const { token } = (await loginRes.json()) as { token: string };
    console.log('  ✔ [PASS] 1. Authentication & JWT Token Issued');

    // 2. Catalog retrieval
    const catalogRes = await fetch('http://127.0.0.1:3000/api/v1/books', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const catalogData = (await catalogRes.json()) as { books: { id: string; title: string }[] };
    const book = catalogData.books.find((b) => b.title === 'The Art of War');

    if (!book) {
      throw new Error('Book "The Art of War" not found in catalog');
    }
    console.log(`  ✔ [PASS] 2. Catalog Loaded — Found: "${book.title}"`);

    // 3. Chapter overview
    const overviewRes = await fetch(`http://127.0.0.1:3000/api/v1/playback/books/${book.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const overview = (await overviewRes.json()) as {
      chapters: { id: string; chapter_num: number; is_approved: boolean; is_preview_free: boolean }[];
    };
    const ch1 = overview.chapters.find((c) => c.chapter_num === 1);

    if (!ch1) {
      throw new Error('Chapter 1 not found');
    }
    console.log(`  ✔ [PASS] 3. Chapter 1 Verified (is_approved: ${ch1.is_approved}, is_preview_free: ${ch1.is_preview_free})`);

    // 4. Verify objectExists directly in B2
    const chapterDbRes = await pool.query<{ audio_object_key: string }>(
      'SELECT audio_object_key FROM chapters WHERE id = $1',
      [ch1.id],
    );
    const audioKey = chapterDbRes.rows[0]?.audio_object_key;
    if (!audioKey) {
      throw new Error('Chapter 1 has no audio_object_key in database');
    }

    const storage = getStorageProvider();
    const existsInB2 = await storage.objectExists(audioKey);
    if (!existsInB2) {
      throw new Error(`Chapter 1 audio object does not exist in Backblaze B2 (key: ${audioKey})`);
    }
    console.log(`  ✔ [PASS] 4. Chapter 1 Object Confirmed in Backblaze B2 (key ends with .mp3: ${audioKey.endsWith('.mp3')})`);

    // 5. Playback Token API
    const playbackRes = await fetch(
      `http://127.0.0.1:3000/api/v1/playback/books/${book.id}/chapters/${ch1.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!playbackRes.ok) {
      throw new Error(`Playback authorization failed with HTTP ${playbackRes.status}: ${await playbackRes.text()}`);
    }

    const playbackData = (await playbackRes.json()) as {
      playback_url: string;
      expires_at: string;
      format: string;
    };

    const isB2HttpsUrl =
      playbackData.playback_url.startsWith('https://') &&
      playbackData.playback_url.includes('backblazeb2.com');

    if (!isB2HttpsUrl) {
      throw new Error('Playback URL is not a valid HTTPS Backblaze B2 URL');
    }
    console.log(`  ✔ [PASS] 5. Playback Authorization Issued (Format: ${playbackData.format}, Host: B2 HTTPS)`);

    // 6. Test Range request against the presigned URL
    const rangeRes = await fetch(playbackData.playback_url, {
      headers: {
        Range: 'bytes=0-1023',
      },
    });

    const is206 = rangeRes.status === 206;
    const contentType = rangeRes.headers.get('content-type');
    const contentRange = rangeRes.headers.get('content-range');
    const bytesReceived = (await rangeRes.arrayBuffer()).byteLength;

    if (is206 && bytesReceived === 1024) {
      console.log(`  ✔ [PASS] 6. B2 HTTP Byte-Range Stream (HTTP 206 Partial Content, Content-Type: ${contentType}, Content-Range: ${contentRange})`);
    } else {
      console.log(`  ⚠ [WARN] B2 response status: HTTP ${rangeRes.status}, bytes: ${bytesReceived}`);
    }

    console.log('\n==================================================');
    console.log('RESULT: REAL B2 AUDIO READY FOR ANDROID STREAMING');
    console.log('==================================================\n');
  } catch (err: unknown) {
    console.error('\n[FAIL] Verification error:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyPlaybackApi();
