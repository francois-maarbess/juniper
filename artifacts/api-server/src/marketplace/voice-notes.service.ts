import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  db,
  voiceNotes,
  resourceFiles,
  bookings,
  studyRequests,
  users,
} from '@workspace/db';

@Injectable()
export class VoiceNotesService {
  private readonly uploadRoot = resolve(process.env.UPLOAD_DIR ?? '.local/uploads');

  constructor() {
    this.ensureDirs().catch(() => undefined);
  }

  private async ensureDirs() {
    await mkdir(join(this.uploadRoot, 'voice-notes'), { recursive: true });
    await mkdir(join(this.uploadRoot, 'resources'), { recursive: true });
  }

  // ── Voice Notes ──────────────────────────────────────────────────────────

  async uploadVoiceNote(
    userId: string,
    params: {
      requestId?: string;
      bookingId?: string;
      file?: Express.Multer.File;
      durationSeconds: number;
    },
  ) {
    if (!params.file) throw new BadRequestException('Provide an audio recording.');
    if (!params.durationSeconds || params.durationSeconds <= 0) {
      throw new BadRequestException('Provide a valid duration in seconds.');
    }

    // Verify booking or request authorization
    if (params.bookingId) {
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, params.bookingId))
        .limit(1);
      if (!booking) throw new NotFoundException('Session workroom not found.');
      if (booking.learnerId !== userId && booking.tutorId !== userId) {
        throw new ForbiddenException('Access denied to this session workroom.');
      }
    } else if (params.requestId) {
      const [req] = await db
        .select()
        .from(studyRequests)
        .where(eq(studyRequests.id, params.requestId))
        .limit(1);
      if (!req) throw new NotFoundException('Study request not found.');
    }

    const noteId = randomUUID();
    const ext = params.file.originalname.endsWith('.m4a')
      ? '.m4a'
      : params.file.originalname.endsWith('.mp3')
      ? '.mp3'
      : '.m4a';
    const filename = `${noteId}${ext}`;
    const destDir = join(this.uploadRoot, 'voice-notes');
    await mkdir(destDir, { recursive: true });
    const destPath = join(destDir, filename);

    if (params.file.buffer) {
      await writeFile(destPath, params.file.buffer);
    } else if ((params.file as any).path) {
      const bytes = await readFile((params.file as any).path);
      await writeFile(destPath, bytes);
    } else {
      throw new BadRequestException('Invalid file upload.');
    }

    const fileUrl = `/api/marketplace/voice-notes/${noteId}/audio`;

    const [created] = await db
      .insert(voiceNotes)
      .values({
        id: noteId,
        requestId: params.requestId ?? null,
        bookingId: params.bookingId ?? null,
        userId,
        fileUrl,
        durationSeconds: Math.round(params.durationSeconds),
      })
      .returning();

    return created;
  }

  async getVoiceNoteAudio(noteId: string) {
    const [note] = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.id, noteId))
      .limit(1);
    if (!note) throw new NotFoundException('Voice note not found.');

    const possibleExts = ['.m4a', '.mp3', '.wav', '.ogg'];
    for (const ext of possibleExts) {
      const path = join(this.uploadRoot, 'voice-notes', `${noteId}${ext}`);
      try {
        const bytes = await readFile(path);
        const mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/m4a';
        return { bytes, mimeType, fileName: `voice-note-${noteId}${ext}` };
      } catch {
        // try next
      }
    }
    throw new NotFoundException('Audio file not found on disk.');
  }

  async listVoiceNotesForRequest(requestId: string) {
    return db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.requestId, requestId))
      .orderBy(desc(voiceNotes.createdAt));
  }

  async listVoiceNotesForBooking(bookingId: string) {
    return db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.bookingId, bookingId))
      .orderBy(desc(voiceNotes.createdAt));
  }

  // ── Shared Resources ─────────────────────────────────────────────────────

  async uploadResource(
    userId: string,
    params: {
      bookingId?: string;
      file?: Express.Multer.File;
    },
  ) {
    if (!params.file) throw new BadRequestException('Provide a document or past exam.');
    const safeName = params.file.originalname.replace(/[\\/\0-\x1f]/g, '_').slice(0, 180) || 'resource';
    const resourceId = randomUUID();
    const destDir = join(this.uploadRoot, 'resources');
    await mkdir(destDir, { recursive: true });
    const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
    const destPath = join(destDir, `${resourceId}${ext}`);

    if (params.file.buffer) {
      await writeFile(destPath, params.file.buffer);
    } else if ((params.file as any).path) {
      const bytes = await readFile((params.file as any).path);
      await writeFile(destPath, bytes);
    } else {
      throw new BadRequestException('Invalid file payload.');
    }

    const url = `/api/marketplace/resources/${resourceId}/download`;
    const sizeBytes = params.file.size ?? (params.file.buffer?.length ?? 0);

    const [created] = await db
      .insert(resourceFiles)
      .values({
        id: resourceId,
        ownerUserId: userId,
        bookingId: params.bookingId ?? null,
        fileName: safeName,
        mimeType: params.file.mimetype || 'application/octet-stream',
        sizeBytes,
        url,
      })
      .returning();

    return created;
  }

  async listResources(userId: string, bookingId?: string) {
    if (bookingId) {
      return db
        .select()
        .from(resourceFiles)
        .where(eq(resourceFiles.bookingId, bookingId))
        .orderBy(desc(resourceFiles.createdAt));
    }
    return db
      .select()
      .from(resourceFiles)
      .where(eq(resourceFiles.ownerUserId, userId))
      .orderBy(desc(resourceFiles.createdAt));
  }

  async downloadResource(userId: string, resourceId: string) {
    const [file] = await db
      .select()
      .from(resourceFiles)
      .where(eq(resourceFiles.id, resourceId))
      .limit(1);
    if (!file) throw new NotFoundException('Resource file not found.');

    const ext = file.fileName.includes('.') ? file.fileName.slice(file.fileName.lastIndexOf('.')) : '';
    const filePath = join(this.uploadRoot, 'resources', `${resourceId}${ext}`);
    const bytes = await readFile(filePath);
    return { bytes, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }
}
