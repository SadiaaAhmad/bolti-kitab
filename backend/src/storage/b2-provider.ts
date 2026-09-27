/**
 * Bolti Kitab — Backblaze B2 Storage Provider (S3-Compatible API)
 *
 * Implements the StorageProvider interface using Backblaze B2 through its S3 API.
 * Active real storage provider for Bolti Kitab Phase 1.
 *
 * SECURITY & ARCHITECTURE:
 *   - The B2 bucket is private (no public anonymous access).
 *   - Uploads use short-lived presigned PUT URLs scoped strictly to server-generated keys.
 *   - Downloads use short-lived presigned GET URLs with inline Content-Type (audio/mpeg)
 *     and Content-Disposition (inline) for direct streaming to mobile (just_audio).
 *   - Standard HTTP Range requests (206 Partial Content) are supported natively by B2 S3 API.
 *   - Heavy audio binaries are NEVER proxied through Fastify application servers.
 */

import fs from 'node:fs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider, UploadAuthorization, DownloadAuthorization } from './types.js';

export interface B2StorageConfig {
  endpoint: string;
  region: string;
  bucketName: string;
  keyId: string;
  applicationKey: string;
}

export class BackblazeB2StorageProvider implements StorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(cfg: B2StorageConfig) {
    if (!cfg.endpoint || !cfg.region || !cfg.bucketName || !cfg.keyId || !cfg.applicationKey) {
      throw new Error(
        '[storage:b2] Incomplete Backblaze B2 configuration. ' +
        'B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME, B2_KEY_ID, and B2_APPLICATION_KEY are required.',
      );
    }

    this.bucketName = cfg.bucketName;
    this.s3Client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.keyId,
        secretAccessKey: cfg.applicationKey,
      },
      forcePathStyle: true,
    });
  }

  async generateUploadUrl(key: string, ttlSeconds: number): Promise<UploadAuthorization> {
    const contentType = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const upload_url = await getSignedUrl(this.s3Client, command, {
      expiresIn: ttlSeconds,
    });

    return {
      upload_url,
      blob_key: key,
      expires_at: expiresAt,
    };
  }

  async generateDownloadUrl(key: string, ttlSeconds: number): Promise<DownloadAuthorization> {
    const contentType = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: 'inline',
    });

    const download_url = await getSignedUrl(this.s3Client, command, {
      expiresIn: ttlSeconds,
    });

    return {
      download_url,
      expires_at: expiresAt,
    };
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        error.name === 'NotFound' ||
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  async uploadFile(key: string, filePath: string, contentType = 'audio/mpeg'): Promise<void> {
    const fileBuffer = await fs.promises.readFile(filePath);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ContentDisposition: 'inline',
    });
    await this.s3Client.send(command);
  }
}
