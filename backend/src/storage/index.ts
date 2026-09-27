/**
 * Bolti Kitab — Storage Provider Factory
 *
 * Reads STORAGE_PROVIDER environment variable and returns the appropriate
 * StorageProvider instance. Defaults to 'mock' for local development and tests.
 *
 * Supported values:
 *   mock  — In-memory mock provider (no credentials required)
 *   azure — Azure Blob Storage (supports Entra ID, StorageSharedKey, Connection String)
 *
 * The factory returns a singleton — the same provider instance is reused
 * across all requests.
 */

import type { StorageProvider } from './types.js';
import { MockStorageProvider } from './mock-provider.js';
import { AzureBlobStorageProvider } from './azure-provider.js';
import { BackblazeB2StorageProvider } from './b2-provider.js';

import { config } from '../config/env.js';

let _provider: StorageProvider | null = null;

// Exported for test access — allows tests to call simulateUpload()
export let mockProvider: MockStorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_provider !== null) {
    return _provider;
  }

  const providerName = process.env['STORAGE_PROVIDER'] ?? config.storage.provider ?? 'mock';

  if (providerName === 'mock') {
    const mp = new MockStorageProvider();
    mockProvider = mp;
    _provider = mp;
    return _provider;
  }

  if (providerName === 'b2') {
    const endpoint = process.env['B2_ENDPOINT'] ?? config.storage.b2.endpoint;
    const region = process.env['B2_REGION'] ?? config.storage.b2.region;
    const bucketName = process.env['B2_BUCKET_NAME'] ?? config.storage.b2.bucketName;
    const keyId = process.env['B2_KEY_ID'] ?? config.storage.b2.keyId;
    const applicationKey = process.env['B2_APPLICATION_KEY'] ?? config.storage.b2.applicationKey;

    if (!endpoint || !region || !bucketName || !keyId || !applicationKey) {
      throw new Error(
        '[storage] Backblaze B2 provider selected (STORAGE_PROVIDER=b2) but required credentials are missing. ' +
        'Please ensure B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME, B2_KEY_ID, and B2_APPLICATION_KEY are configured in .env.',
      );
    }

    _provider = new BackblazeB2StorageProvider({
      endpoint,
      region,
      bucketName,
      keyId,
      applicationKey,
    });
    return _provider;
  }

  if (providerName === 'azure') {
    const accountName = process.env['AZURE_STORAGE_ACCOUNT_NAME'] ?? config.storage.accountName;
    const containerName = process.env['AZURE_STORAGE_CONTAINER_NAME'] ?? config.storage.containerName ?? 'audiobooks-private';
    const accountKey = process.env['AZURE_STORAGE_ACCOUNT_KEY'] ?? config.storage.accountKey;
    const connectionString = process.env['AZURE_STORAGE_CONNECTION_STRING'] ?? config.storage.connectionString;

    if (!accountName && !connectionString) {
      throw new Error(
        '[storage] Azure provider requires AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING. ' +
        'Configure Azure credentials in .env or set STORAGE_PROVIDER=mock for local test mode.',
      );
    }

    _provider = new AzureBlobStorageProvider({
      accountName: accountName ?? '',
      containerName,
      accountKey: accountKey || undefined,
      connectionString: connectionString || undefined,
    });
    return _provider;
  }

  throw new Error(
    `[storage] Unknown STORAGE_PROVIDER: "${providerName}". ` +
    'Supported values: mock, b2, azure',
  );
}

/** Reset the singleton — only used in tests to get a fresh provider per suite. */
export function resetStorageProvider(): void {
  if (mockProvider !== null) {
    mockProvider.reset();
    mockProvider = null;
  }
  _provider = null;
}
