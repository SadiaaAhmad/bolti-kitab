# Storage Provider Configuration & Backblaze B2 Integration Guide

Bolti Kitab utilizes a decoupled `StorageProvider` abstraction for private object storage, direct client uploads, and streaming downloads.

---

## 1. Provider Abstraction Architecture

The backend never proxies heavy audio binaries through application servers. All operations follow presigned/authorized delegation:

```
[ Flutter Mobile / Web ]
      │             ▲
1. Request     4. Direct Stream / Upload
   Authorization  (with Range support)
      │             │
      ▼             │
[ Backend API ] ─── 3. Presigned URL ───► [ Backblaze B2 / Storage Provider ]
```

### StorageProvider Interface

```typescript
export interface StorageProvider {
  // Generates short-lived write authorization URL for client upload
  generateUploadUrl(key: string, ttlSeconds: number): Promise<UploadAuthorization>;

  // Generates short-lived read authorization URL for client playback
  generateDownloadUrl(key: string, ttlSeconds: number): Promise<DownloadAuthorization>;

  // Verifies that the blob object actually exists in private storage
  objectExists(key: string): Promise<boolean>;

  // Deletes an object from storage
  deleteObject(key: string): Promise<void>;

  // Uploads a local file directly into storage (ingestion / tools)
  uploadFile?(key: string, filePath: string, contentType?: string): Promise<void>;
}
```

---

## 2. Active Provider: Backblaze B2 (Phase 1 Real Storage)

Phase 1 development and live streaming utilize **Backblaze B2** via its S3-Compatible API.

### Environment Variables

| Variable | Description | Value / Example |
| :--- | :--- | :--- |
| `STORAGE_PROVIDER` | Active provider | `b2` (default in code: `mock`) |
| `B2_ENDPOINT` | B2 S3-compatible API endpoint | `https://s3.eu-central-003.backblazeb2.com` |
| `B2_REGION` | Bucket region | `eu-central-003` |
| `B2_BUCKET_NAME` | Dedicated media bucket | `bolti-kitab-media` |
| `B2_KEY_ID` | Application Key ID | *(configured in .env)* |
| `B2_APPLICATION_KEY` | Application Key Secret | *(configured in .env)* |
| `STORAGE_UPLOAD_TTL_SECONDS` | Lifetime of presigned upload URL | `1800` (30 minutes) |
| `STORAGE_PLAYBACK_TTL_SECONDS` | Lifetime of presigned download URL | `3600` (1 hour) |

### Security & S3-Compatible Presigned URL Rules

1. **Private Bucket**:
   - The bucket `bolti-kitab-media` is private. No public anonymous access is allowed.
2. **Presigned URL Scoping**:
   - Upload and download URLs are signed per-object with short expiration times.
   - Streaming URLs specify `ResponseContentType: 'audio/mpeg'` and `ResponseContentDisposition: 'inline'`.
3. **HTTP Byte-Range Streaming**:
   - Backblaze B2 natively supports HTTP `Range: bytes=...` requests (`206 Partial Content`), allowing `just_audio` / ExoPlayer on mobile to seek instantly.
4. **Real B2 Verification Command**:
   ```bash
   npm run test:storage:b2
   ```

---

## 3. Alternate Provider: Azure Blob Storage (Retained)

Azure Blob Storage remains fully implemented as an alternate provider in `AzureBlobStorageProvider`. It can be activated by setting `STORAGE_PROVIDER=azure` and providing Azure credentials:

| Variable | Description |
| :--- | :--- |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account name |
| `AZURE_STORAGE_CONTAINER_NAME`| Private audio container (`audiobooks-private`) |
| `AZURE_STORAGE_ACCOUNT_KEY` | Storage account key |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string |

---

## 4. Local Development & Testing (`MockStorageProvider`)

When `STORAGE_PROVIDER=mock` (the safe default in code), the in-memory provider simulates presigned URLs and object existence without requiring live cloud credentials, used for all hermetic unit and integration test suites.
