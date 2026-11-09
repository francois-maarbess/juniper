import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db/db';
import {
  voiceNotes,
  resourceFiles,
  type VoiceNote,
  type ResourceFile,
} from '../db/voice-notes-schema';

@Injectable()
export class VoiceNotesService {
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') ?? path.join(process.cwd(), 'uploads');
    this.ensureDir(this.uploadDir);
    this.ensureDir(path.join(this.uploadDir, 'voice-notes'));
    this.ensureDir(path.join(this.uploadDir, 'resources'));
  }

  // ---------------------------------------------------------------------------
  // Voice Notes
  // ---------------------------------------------------------------------------

  /**
   * Save a recorded voice note for a study request.
   * The file is persisted to disk and a DB record is created.
   */
  async uploadVoiceNote(
    requestId: string,
    userId: string,
    file: Express.Multer.File,
    durationSeconds: number,
  ): Promise<VoiceNote> {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const destDir = path.join(this.uploadDir, 'voice-notes');
    const ext = path.extname(file.originalname) || '.m4a';
    const filename = `${requestId}_${userId}_${Date.now()}${ext}`;
    const destPath = path.join(destDir, filename);

    try {
      if (file.path) {
        // Multer disk storage — move the temp file to our organised dir
        fs.renameSync(file.path, destPath);
      } else if (file.buffer) {
        // Multer memory storage
        fs.writeFileSync(destPath, file.buffer);
      } else {
        throw new BadRequestException('Unsupported file storage mode');
      }
    } catch (err) {
      throw new InternalServerErrorException(`Failed to persist voice note: ${(err as Error).message}`);
    }

    const fileUrl = `/uploads/voice-notes/${filename}`;

    const [record] = await db
      .insert(voiceNotes)
      .values({
        requestId,
        userId,
        fileUrl,
        durationSeconds: Math.round(durationSeconds),
      })
      .returning();

    return record;
  }

  /**
   * Retrieve the most recent voice note for a given study request.
   */
  async getVoiceNote(requestId: string): Promise<VoiceNote> {
    const [record] = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.requestId, requestId))
      .orderBy(voiceNotes.createdAt)
      .limit(1);

    if (!record) {
      throw new NotFoundException(`No voice note found for request ${requestId}`);
    }

    return record;
  }

  /**
   * Retrieve all voice notes associated with a study request.
   */
  async listVoiceNotes(requestId: string): Promise<VoiceNote[]> {
    return db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.requestId, requestId))
      .orderBy(voiceNotes.createdAt);
  }

  // ---------------------------------------------------------------------------
  // Resource Files
  // ---------------------------------------------------------------------------

  /**
   * Upload a resource file (PDF, image, etc.) to the user's resource library.
   */
  async uploadResource(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ResourceFile> {
    if (!file) {
      throw new BadRequestException('No resource file provided');
    }

    const destDir = path.join(this.uploadDir, 'resources');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${userId}_${Date.now()}_${safeName}`;
    const destPath = path.join(destDir, filename);

    try {
      if (file.path) {
        fs.renameSync(file.path, destPath);
      } else if (file.buffer) {
        fs.writeFileSync(destPath, file.buffer);
      } else {
        throw new BadRequestException('Unsupported file storage mode');
      }
    } catch (err) {
      throw new InternalServerErrorException(`Failed to persist resource: ${(err as Error).message}`);
    }

    const url = `/uploads/resources/${filename}`;
    const sizeBytes = file.size ?? (file.buffer?.length ?? 0);

    const [record] = await db
      .insert(resourceFiles)
      .values({
        ownerUserId: userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        url,
      })
      .returning();

    return record;
  }

  /**
   * List all resource files uploaded by a specific user.
   */
  async listResources(userId: string): Promise<ResourceFile[]> {
    return db
      .select()
      .from(resourceFiles)
      .where(eq(resourceFiles.ownerUserId, userId))
      .orderBy(resourceFiles.createdAt);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
