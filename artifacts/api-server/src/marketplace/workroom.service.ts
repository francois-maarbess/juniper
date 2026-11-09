import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { db, workroomWhiteboards, workroomRecordings, bookings } from '@workspace/db';
import { eq, and, or, sql } from 'drizzle-orm';

@Injectable()
export class WorkroomService {
  private async requireBookingAccess(bookingId: string, userId: string) {
    const [booking] = await db.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.id, bookingId), or(eq(bookings.learnerId, userId), eq(bookings.tutorId, userId)))).limit(1);
    if (!booking) throw new NotFoundException('Session not found.');
  }

  async getIceServers(bookingId: string, userId: string) {
    await this.requireBookingAccess(bookingId, userId);
    const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: 'stun:stun.l.google.com:19302' },
    ];
    const urls = (process.env.TURN_SERVER_URLS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const sharedSecret = process.env.TURN_SHARED_SECRET;
    if (urls.length && sharedSecret) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
      const username = `${expiresAt}:${userId}`;
      const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');
      servers.push({ urls, username, credential });
    }
    return { iceServers: servers };
  }

  async getWhiteboard(bookingId: string, userId: string) {
    await this.requireBookingAccess(bookingId, userId);
    const [wb] = await db.select().from(workroomWhiteboards).where(eq(workroomWhiteboards.bookingId, bookingId)).limit(1);
    if (!wb) {
      const [created] = await db.insert(workroomWhiteboards).values({
        id: randomUUID(), bookingId, elements: [], version: 0,
      }).returning();
      return created;
    }
    return wb;
  }

  async updateWhiteboard(bookingId: string, userId: string, elements: unknown[], version: number) {
    await this.requireBookingAccess(bookingId, userId);
    const [wb] = await db.select().from(workroomWhiteboards).where(eq(workroomWhiteboards.bookingId, bookingId)).limit(1);
    if (!wb) throw new NotFoundException('Whiteboard not found.');
    if (version < wb.version) {
      // Conflict: client is stale, return server version
      return { conflict: true, serverElements: wb.elements, serverVersion: wb.version };
    }
    const [updated] = await db.update(workroomWhiteboards).set({
      elements: elements as any,
      version: wb.version + 1,
      updatedAt: new Date(),
      updatedBy: userId,
    }).where(eq(workroomWhiteboards.bookingId, bookingId)).returning();
    return { conflict: false, whiteboard: updated };
  }

  async clearWhiteboard(bookingId: string, userId: string) {
    await this.requireBookingAccess(bookingId, userId);
    const [wb] = await db.select().from(workroomWhiteboards).where(eq(workroomWhiteboards.bookingId, bookingId)).limit(1);
    if (!wb) throw new NotFoundException('Whiteboard not found.');
    const [updated] = await db.update(workroomWhiteboards).set({
      elements: [], version: wb.version + 1, updatedAt: new Date(), updatedBy: userId,
    }).where(eq(workroomWhiteboards.bookingId, bookingId)).returning();
    return updated;
  }

  async startRecording(bookingId: string, userId: string) {
    const [rec] = await db.insert(workroomRecordings).values({
      id: randomUUID(), bookingId, status: 'recording', startedBy: userId,
    }).returning();
    return rec;
  }

  async endRecording(recordingId: string, url: string, durationSeconds: number) {
    const [updated] = await db.update(workroomRecordings).set({
      status: 'ready', url, durationSeconds, endedAt: new Date(),
    }).where(eq(workroomRecordings.id, recordingId)).returning();
    return updated;
  }

  async listRecordings(bookingId: string) {
    return db.select().from(workroomRecordings).where(eq(workroomRecordings.bookingId, bookingId)).orderBy(workroomRecordings.createdAt);
  }
}
