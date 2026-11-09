import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, db, eq, isNull, lt, messageAttachments } from '@workspace/db';
import { TutorDocumentStorage } from './tutor-document-storage.js';

@Injectable()
export class MessageAttachmentCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageAttachmentCleanupService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly storage: TutorDocumentStorage) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.cleanup(), 60 * 60 * 1000);
    void this.cleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async cleanup() {
    if (this.running) return;
    this.running = true;
    try {
      const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expired = await db.select({ id: messageAttachments.id, storageKey: messageAttachments.storageKey })
        .from(messageAttachments).where(and(isNull(messageAttachments.messageId), lt(messageAttachments.createdAt, expiry)))
        .limit(100);
      for (const item of expired) {
        await this.storage.remove(item.storageKey);
        await db.delete(messageAttachments).where(and(
          isNull(messageAttachments.messageId),
          lt(messageAttachments.createdAt, expiry),
          eq(messageAttachments.storageKey, item.storageKey),
        ));
      }
    } catch (error) {
      this.logger.warn(`Staged chat file cleanup will retry: ${error instanceof Error ? error.message : 'storage or database error'}`);
    } finally {
      this.running = false;
    }
  }
}
