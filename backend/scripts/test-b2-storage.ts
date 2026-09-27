/**
 * Bolti Kitab — Real Backblaze B2 Storage Integration Test
 *
 * Verifies live S3-compatible connectivity and operations against Backblaze B2:
 *   [1] Provider instantiation with B2 configuration
 *   [2] Upload tiny temporary test object
 *   [3] objectExists() returns true
 *   [4] generateDownloadUrl() issues valid presigned URL
 *   [5] HTTP GET download via presigned URL
 *   [6] Byte content verification
 *   [7] deleteObject()
 *   [8] objectExists() returns false
 *
 * SECURITY:
 *   - NEVER prints application keys, credentials, or signed URLs.
 *   - Reports ONLY PASS/FAIL status for each operation.
 */

import 'dotenv/config.js';
import { randomUUID } from 'node:crypto';
import { getStorageProvider, resetStorageProvider } from '../src/storage/index.js';
import { BackblazeB2StorageProvider } from '../src/storage/b2-provider.js';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

async function runB2IntegrationTest(): Promise<void> {
  const results: TestResult[] = [];
  const logStep = (step: string, status: 'PASS' | 'FAIL', details?: string) => {
    results.push({ step, status, details });
    const mark = status === 'PASS' ? '✔' : '✖';
    console.log(`  ${mark} [${status}] ${step}${details ? ` (${details})` : ''}`);
  };

  console.log('\n==================================================');
  console.log('BOLTI KITAB — BACKBLAZE B2 REAL STORAGE TEST');
  console.log('==================================================\n');

  // Verify environment preconditions
  const provider = process.env['STORAGE_PROVIDER'];
  if (provider !== 'b2') {
    console.error(`[SKIP] STORAGE_PROVIDER is '${provider}', not 'b2'.`);
    console.error('This real integration test runs only when STORAGE_PROVIDER=b2.');
    process.exit(1);
  }

  const endpoint = process.env['B2_ENDPOINT'];
  const region = process.env['B2_REGION'];
  const bucket = process.env['B2_BUCKET_NAME'];
  const keyId = process.env['B2_KEY_ID'];
  const appKey = process.env['B2_APPLICATION_KEY'];

  if (!endpoint || !region || !bucket || !keyId || !appKey) {
    console.error('[FAIL] Missing one or more required B2 environment variables.');
    process.exit(1);
  }

  resetStorageProvider();
  const storage = getStorageProvider();

  if (!(storage instanceof BackblazeB2StorageProvider)) {
    console.error('[FAIL] Resolved storage provider is not an instance of BackblazeB2StorageProvider.');
    process.exit(1);
  }

  const testKey = `integration-tests/test-${randomUUID()}.txt`;
  const expectedContent = `Bolti Kitab B2 Live Storage Test: ${new Date().toISOString()}`;

  try {
    // 1. Connection & Provider initialization
    logStep('1. B2 Provider Initialization', 'PASS', `bucket: ${bucket}, region: ${region}`);

    // 2. Upload tiny temporary test object via presigned upload URL or uploadFile
    const uploadAuth = await storage.generateUploadUrl(testKey, 300);
    const putRes = await fetch(uploadAuth.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: expectedContent,
    });

    if (putRes.ok) {
      logStep('2. Direct Presigned Upload (PUT)', 'PASS', `HTTP ${putRes.status}`);
    } else {
      logStep('2. Direct Presigned Upload (PUT)', 'FAIL', `HTTP ${putRes.status}`);
      throw new Error(`Upload returned status ${putRes.status}`);
    }

    // 3. objectExists() returns true
    const existsAfterUpload = await storage.objectExists(testKey);
    if (existsAfterUpload) {
      logStep('3. objectExists() Verification', 'PASS', 'Object confirmed in bucket');
    } else {
      logStep('3. objectExists() Verification', 'FAIL', 'Object not found after upload');
      throw new Error('objectExists returned false after upload');
    }

    // 4. generateDownloadUrl() succeeds
    const downloadAuth = await storage.generateDownloadUrl(testKey, 300);
    if (downloadAuth.download_url && downloadAuth.expires_at) {
      logStep('4. generateDownloadUrl() Presigned Generation', 'PASS');
    } else {
      logStep('4. generateDownloadUrl() Presigned Generation', 'FAIL');
      throw new Error('generateDownloadUrl failed to return valid authorization');
    }

    // 5. Download object via presigned URL
    const getRes = await fetch(downloadAuth.download_url);
    if (getRes.ok) {
      logStep('5. HTTP Download via Presigned URL', 'PASS', `HTTP ${getRes.status}`);
    } else {
      logStep('5. HTTP Download via Presigned URL', 'FAIL', `HTTP ${getRes.status}`);
      throw new Error(`Download returned status ${getRes.status}`);
    }

    // 6. Verify returned bytes/content
    const downloadedText = await getRes.text();
    if (downloadedText === expectedContent) {
      logStep('6. Content & Byte Integrity Verification', 'PASS', `${downloadedText.length} bytes match`);
    } else {
      logStep('6. Content & Byte Integrity Verification', 'FAIL', 'Byte mismatch');
      throw new Error('Downloaded content did not match uploaded content');
    }

    // 7. Delete temporary object
    await storage.deleteObject(testKey);
    logStep('7. deleteObject() Operation', 'PASS');

    // 8. objectExists() returns false
    const existsAfterDelete = await storage.objectExists(testKey);
    if (!existsAfterDelete) {
      logStep('8. objectExists() After Deletion', 'PASS', 'Confirmed removed from bucket');
    } else {
      logStep('8. objectExists() After Deletion', 'FAIL', 'Object still exists after delete');
      throw new Error('objectExists returned true after delete');
    }

    console.log('\n==================================================');
    console.log('RESULT: ALL 8 B2 STORAGE OPERATIONS PASSED');
    console.log('==================================================\n');
  } catch (err: unknown) {
    console.error('\n==================================================');
    console.error('RESULT: B2 STORAGE TEST FAILED');
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    console.error('==================================================\n');
    process.exit(1);
  }
}

runB2IntegrationTest();
