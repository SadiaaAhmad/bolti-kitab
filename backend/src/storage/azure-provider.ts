/**
 * Bolti Kitab — Azure Blob Storage Provider
 *
 * Implements the StorageProvider interface using Azure Blob Storage.
 *
 * SECURITY & ARCHITECTURE:
 *   - Follows Microsoft best practices: uses DefaultAzureCredential and
 *     User Delegation SAS where possible, with fallback to StorageSharedKeyCredential
 *     or Connection String.
 *   - All SAS tokens are per-blob and short-lived with strict least-privilege permissions.
 *   - The container is private (no public anonymous access).
 *   - Presigned download URLs support HTTP range requests for audio seeking.
 */

import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  type UserDelegationKey,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import type { StorageProvider, UploadAuthorization, DownloadAuthorization } from './types.js';

export interface AzureStorageConfig {
  accountName: string;
  containerName: string;
  accountKey?: string | undefined;
  connectionString?: string | undefined;
}

export class AzureBlobStorageProvider implements StorageProvider {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;
  private readonly accountName: string;
  private readonly containerName: string;
  private readonly sharedKeyCredential: StorageSharedKeyCredential | null = null;
  private readonly defaultAzureCredential: DefaultAzureCredential | null = null;

  // Cached user delegation key to avoid fetching per-request when valid
  private cachedUserDelegationKey: { key: UserDelegationKey; expiresOn: Date } | null = null;

  constructor(cfg: AzureStorageConfig) {
    this.accountName = cfg.accountName;
    this.containerName = cfg.containerName;

    if (cfg.connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(cfg.connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      // Try extracting account key and name if available in connection string
      const matchKey = cfg.connectionString.match(/AccountKey=([^;]+)/);
      const matchName = cfg.connectionString.match(/AccountName=([^;]+)/);
      if (matchKey && matchName && matchKey[1] && matchName[1]) {
        this.sharedKeyCredential = new StorageSharedKeyCredential(matchName[1], matchKey[1]);
        this.accountName = matchName[1];
      }
    } else if (cfg.accountKey) {
      this.sharedKeyCredential = new StorageSharedKeyCredential(cfg.accountName, cfg.accountKey);
      this.blobServiceClient = new BlobServiceClient(
        `https://${cfg.accountName}.blob.core.windows.net`,
        this.sharedKeyCredential,
      );
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    } else {
      // Entra ID / DefaultAzureCredential (Managed Identity / Azure CLI / App Registration)
      this.defaultAzureCredential = new DefaultAzureCredential();
      this.blobServiceClient = new BlobServiceClient(
        `https://${cfg.accountName}.blob.core.windows.net`,
        this.defaultAzureCredential,
      );
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    }
  }

  private async getUserDelegationKey(): Promise<UserDelegationKey> {
    const now = new Date();
    if (
      this.cachedUserDelegationKey &&
      this.cachedUserDelegationKey.expiresOn.getTime() - now.getTime() > 5 * 60 * 1000
    ) {
      return this.cachedUserDelegationKey.key;
    }

    const startsOn = new Date(now.getTime() - 5 * 60 * 1000); // 5 min clock skew tolerance
    const expiresOn = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour delegation key

    const key = await this.blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
    this.cachedUserDelegationKey = { key, expiresOn };
    return key;
  }

  async generateUploadUrl(key: string, ttlSeconds: number): Promise<UploadAuthorization> {
    const startsOn = new Date(Date.now() - 60 * 1000); // 1 min skew allowance
    const expiresOn = new Date(Date.now() + ttlSeconds * 1000);

    const permissions = BlobSASPermissions.parse('cw'); // create, write

    let sasToken: string;

    if (this.sharedKeyCredential) {
      sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
        },
        this.sharedKeyCredential,
      ).toString();
    } else {
      const userDelegationKey = await this.getUserDelegationKey();
      sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
        },
        userDelegationKey,
        this.accountName,
      ).toString();
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    const upload_url = `${blockBlobClient.url}?${sasToken}`;

    return {
      upload_url,
      blob_key: key,
      expires_at: expiresOn.toISOString(),
    };
  }

  async generateDownloadUrl(key: string, ttlSeconds: number): Promise<DownloadAuthorization> {
    const startsOn = new Date(Date.now() - 60 * 1000);
    const expiresOn = new Date(Date.now() + ttlSeconds * 1000);

    const permissions = BlobSASPermissions.parse('r'); // read
    const contentType = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

    let sasToken: string;

    if (this.sharedKeyCredential) {
      sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
          contentType,
          contentDisposition: 'inline',
        },
        this.sharedKeyCredential,
      ).toString();
    } else {
      const userDelegationKey = await this.getUserDelegationKey();
      sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions,
          startsOn,
          expiresOn,
          contentType,
          contentDisposition: 'inline',
        },
        userDelegationKey,
        this.accountName,
      ).toString();
    }

    const blobClient = this.containerClient.getBlobClient(key);
    const download_url = `${blobClient.url}?${sasToken}`;

    return {
      download_url,
      expires_at: expiresOn.toISOString(),
    };
  }

  async uploadFile(key: string, filePath: string, contentType = 'audio/mpeg'): Promise<void> {
    await this.containerClient.createIfNotExists();
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    await blockBlobClient.uploadFile(filePath, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });
  }

  async objectExists(key: string): Promise<boolean> {
    const blobClient = this.containerClient.getBlobClient(key);
    return blobClient.exists();
  }

  async deleteObject(key: string): Promise<void> {
    const blobClient = this.containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  }
}
