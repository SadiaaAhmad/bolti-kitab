# ADR-003: Phase 1 Object Storage Provider Substitution: Backblaze B2 Active; Azure Retained as Alternate Provider

## Status
Accepted

## Context
During Phase 1 implementation, Microsoft Azure for Students activation was blocked by Microsoft's academic email verification flow. The project requires real cloud object storage with private bucket scoping, presigned upload/download authorization, and byte-range HTTP streaming support (`Range: bytes=...`) so that the Flutter mobile application (`just_audio`) can play real audiobooks on physical devices.

Bolti Kitab's architecture was intentionally designed around a decoupled `StorageProvider` abstraction boundary.

## Decision
1. **Backblaze B2** is adopted as the active real object-storage provider for Phase 1 development and integration via its S3-Compatible API.
2. The B2 bucket `bolti-kitab-media` (Region `eu-central-003`, Endpoint `https://s3.eu-central-003.backblazeb2.com`) is designated for audiobook media storage.
3. `BackblazeB2StorageProvider` is implemented using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
4. `AzureBlobStorageProvider` is retained in the codebase as an alternate provider and not removed.
5. The code default for `STORAGE_PROVIDER` is set to `mock` for safe local testing and hermetic test suite execution.
6. The PostgreSQL schema is unmodified.
7. Recording and playback business logic modules remain unchanged.

## Consequences
- **Positive**:
  - Unblocks mobile development immediately with real cloud storage and byte-range streaming.
  - S3-compatible API standard ensures high portability across cloud providers.
  - Full adherence to the security contract: private bucket, no binary proxying through application servers, short-lived presigned URLs.
- **Negative / Trade-offs**:
  - Requires maintaining both B2 and Azure provider implementations.
  - Requires S3 SDK packages (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
