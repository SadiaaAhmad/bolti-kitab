/**
 * Bolti Kitab — Storage Provider Abstraction
 *
 * Defines the interface all storage backends must implement.
 * Business logic depends only on this interface — no Azure/Vultr SDK types leak upward.
 *
 * SECURITY CONTRACT:
 *   - blob keys are generated server-side by the application, never accepted from clients
 *   - upload URLs are short-lived and scoped to a single object key
 *   - objectExists() is the server's authority on whether an upload completed
 */

export interface UploadAuthorization {
  /** Short-lived pre-signed URL or SAS token URL. Client uses this to PUT audio. */
  upload_url: string;
  /** The server-generated object key. Returned to the client for reference only. */
  blob_key: string;
  /** ISO 8601 timestamp when the upload_url expires. */
  expires_at: string;
}

export interface DownloadAuthorization {
  /** Short-lived read authorization URL. Client uses this to stream audio. */
  download_url: string;
  /** ISO 8601 timestamp when the download_url expires. */
  expires_at: string;
}

export interface StorageProvider {
  /**
   * Generate a short-lived write-scoped upload authorization for the given key.
   * The key must be server-generated before this call.
   */
  generateUploadUrl(key: string, ttlSeconds: number): Promise<UploadAuthorization>;

  /**
   * Generate a short-lived read-scoped download/streaming authorization for the given key.
   */
  generateDownloadUrl(key: string, ttlSeconds: number): Promise<DownloadAuthorization>;

  /**
   * Check whether an object with the given key exists in storage.
   * Used to verify the narrator completed their upload before confirming a take.
   */
  objectExists(key: string): Promise<boolean>;

  /**
   * Delete an object from storage.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Upload a local file directly into storage (used by server-side ingestion scripts/tools).
   */
  uploadFile?(key: string, filePath: string, contentType?: string): Promise<void>;
}

