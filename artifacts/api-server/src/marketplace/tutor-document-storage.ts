import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TutorDocumentStorage {
  private readonly root = resolve(process.env.TUTOR_DOCUMENTS_DIR ?? '.local/tutor-documents');
  private readonly s3 = process.env.TUTOR_DOCUMENT_STORAGE === 's3'
    ? new S3Client({
      region: process.env.STORAGE_REGION ?? 'us-east-1',
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      ...(process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
        ? {
          credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
          },
        }
        : {}),
    })
    : null;
  private readonly bucket = process.env.STORAGE_BUCKET;

  constructor() {
    if (process.env.NODE_ENV === 'production' && !['replit', 's3'].includes(process.env.TUTOR_DOCUMENT_STORAGE ?? '')) {
      throw new Error('Configure private S3-compatible or Replit object storage for tutor qualification documents before production startup.');
    }
    if (process.env.TUTOR_DOCUMENT_STORAGE === 's3' && !this.bucket) {
      throw new Error('STORAGE_BUCKET must be configured when TUTOR_DOCUMENT_STORAGE=s3.');
    }
  }

  async save(key: string, bytes: Buffer) {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
      }));
      return;
    }
    if (process.env.TUTOR_DOCUMENT_STORAGE === 'replit') {
      const { Client } = await import('@replit/object-storage');
      const result = await new Client().uploadFromBytes(key, bytes);
      if (!result.ok) throw new Error(`Private document storage failed: ${result.error.message}`);
      return;
    }
    const path = this.localPath(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  }

  async read(key: string) {
    if (this.s3) {
      const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) throw new Error('Private document retrieval returned no content.');
      return Buffer.from(await result.Body.transformToByteArray());
    }
    if (process.env.TUTOR_DOCUMENT_STORAGE === 'replit') {
      const { Client } = await import('@replit/object-storage');
      const result = await new Client().downloadAsBytes(key);
      if (!result.ok) throw new Error(`Private document retrieval failed: ${result.error.message}`);
      return result.value[0];
    }
    return readFile(this.localPath(key));
  }

  async remove(key: string) {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }
    if (process.env.TUTOR_DOCUMENT_STORAGE === 'replit') {
      const { Client } = await import('@replit/object-storage');
      const result = await new Client().delete(key, { ignoreNotFound: true });
      if (!result.ok) throw new Error(`Private document deletion failed: ${result.error.message}`);
      return;
    }
    await unlink(this.localPath(key)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
  }

  private localPath(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}/`) && !path.startsWith(`${this.root}\\`)) throw new Error('Invalid document storage key.');
    return path;
  }
}
