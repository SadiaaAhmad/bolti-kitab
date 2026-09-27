/**
 * Bolti Kitab — Backblaze B2 Storage Provider Unit Tests
 *
 * Hermetic unit test verifying configuration validation and provider contract
 * without requiring live cloud credentials.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BackblazeB2StorageProvider } from './b2-provider.js';

describe('BackblazeB2StorageProvider (Hermetic Unit Tests)', () => {
  it('throws an informative error if configuration is incomplete', () => {
    assert.throws(
      () => {
        new BackblazeB2StorageProvider({
          endpoint: '',
          region: 'eu-central-003',
          bucketName: 'bolti-kitab-media',
          keyId: '',
          applicationKey: '',
        });
      },
      /Incomplete Backblaze B2 configuration/,
    );
  });

  it('instantiates successfully with valid configuration structure', () => {
    const provider = new BackblazeB2StorageProvider({
      endpoint: 'https://s3.eu-central-003.backblazeb2.com',
      region: 'eu-central-003',
      bucketName: 'bolti-kitab-media',
      keyId: 'dummy-key-id',
      applicationKey: 'dummy-application-key',
    });

    assert.ok(provider, 'Provider instance should be created');
    assert.equal(typeof provider.generateUploadUrl, 'function');
    assert.equal(typeof provider.generateDownloadUrl, 'function');
    assert.equal(typeof provider.objectExists, 'function');
    assert.equal(typeof provider.deleteObject, 'function');
    assert.equal(typeof provider.uploadFile, 'function');
  });

  it('generates presigned upload URL and authorization metadata', async () => {
    const provider = new BackblazeB2StorageProvider({
      endpoint: 'https://s3.eu-central-003.backblazeb2.com',
      region: 'eu-central-003',
      bucketName: 'bolti-kitab-media',
      keyId: 'dummy-key-id',
      applicationKey: 'dummy-application-key',
    });

    const key = 'recordings/sess-123/take-1.mp3';
    const auth = await provider.generateUploadUrl(key, 900);

    assert.equal(auth.blob_key, key);
    assert.ok(auth.upload_url.includes('bolti-kitab-media'));
    assert.ok(auth.upload_url.includes(encodeURIComponent(key)) || auth.upload_url.includes(key));
    assert.ok(auth.expires_at);
  });

  it('generates presigned download URL with inline disposition and audio/mpeg content type', async () => {
    const provider = new BackblazeB2StorageProvider({
      endpoint: 'https://s3.eu-central-003.backblazeb2.com',
      region: 'eu-central-003',
      bucketName: 'bolti-kitab-media',
      keyId: 'dummy-key-id',
      applicationKey: 'dummy-application-key',
    });

    const key = 'recordings/sess-123/take-1.mp3';
    const auth = await provider.generateDownloadUrl(key, 3600);

    assert.ok(auth.download_url.includes('bolti-kitab-media'));
    assert.ok(auth.download_url.includes('response-content-type=audio%2Fmpeg'));
    assert.ok(auth.download_url.includes('response-content-disposition=inline'));
    assert.ok(auth.expires_at);
  });
});
