import type { StorageProvider, UploadAuthorization, DownloadAuthorization } from './types.js';

export class MockStorageProvider implements StorageProvider {
  private readonly existingObjects = new Set<string>();

  async generateUploadUrl(key: string, ttlSeconds: number): Promise<UploadAuthorization> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const upload_url = `mock://storage/upload/${key}?ttl=${ttlSeconds}`;
    return { upload_url, blob_key: key, expires_at: expiresAt };
  }

  async generateDownloadUrl(key: string, ttlSeconds: number): Promise<DownloadAuthorization> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const download_url = `mock://storage/download/${key}?ttl=${ttlSeconds}`;
    return { download_url, expires_at: expiresAt };
  }

  simulateUpload(key: string): void {
    this.existingObjects.add(key);
  }

  async uploadFile(key: string, _filePath: string, _contentType = 'audio/mpeg'): Promise<void> {
    this.existingObjects.add(key);
  }

  async objectExists(key: string): Promise<boolean> {
    return this.existingObjects.has(key);
  }

  async deleteObject(key: string): Promise<void> {
    this.existingObjects.delete(key);
  }

  reset(): void {
    this.existingObjects.clear();
  }
}
