import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  db,
  tutorVaultItems,
  tutorProfiles,
  users,
  vaultPurchases,
} from '@workspace/db';

@Injectable()
export class TutorVaultService {
  private readonly uploadRoot = resolve(process.env.UPLOAD_DIR ?? '.local/uploads');

  constructor() {
    mkdir(join(this.uploadRoot, 'tutor-vault'), { recursive: true }).catch(() => undefined);
  }

  async uploadVaultItem(
    tutorUserId: string,
    params: {
      title: string;
      description?: string;
      priceCents?: number;
      file?: Express.Multer.File;
    },
  ) {
    if (!params.file) throw new BadRequestException('Select a study note, recap, or cheat sheet.');
    if (!params.title || params.title.trim().length < 3) {
      throw new BadRequestException('Provide a title for this study note (min 3 characters).');
    }

    const safeName = params.file.originalname.replace(/[\\/\0-\x1f]/g, '_').slice(0, 180) || 'vault-item';
    const itemId = randomUUID();
    const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
    const destDir = join(this.uploadRoot, 'tutor-vault');
    await mkdir(destDir, { recursive: true });
    const destPath = join(destDir, `${itemId}${ext}`);

    if (params.file.buffer) {
      await writeFile(destPath, params.file.buffer);
    } else if ((params.file as any).path) {
      const bytes = await readFile((params.file as any).path);
      await writeFile(destPath, bytes);
    } else {
      throw new BadRequestException('Invalid file upload.');
    }

    const fileUrl = `/api/marketplace/tutor-vault/${itemId}/download`;

    const [created] = await db
      .insert(tutorVaultItems)
      .values({
        id: itemId,
        tutorUserId,
        title: params.title.trim().slice(0, 150),
        description: params.description?.trim().slice(0, 500) ?? null,
        fileUrl,
        mimeType: params.file.mimetype || 'application/pdf',
        isPublic: true,
        priceCents: params.priceCents ?? 0,
      })
      .returning();

    return created;
  }

  async listVaultItems(tutorUserId: string, buyerId?: string) {
    const rows = await db
      .select({
        id: tutorVaultItems.id,
        tutorUserId: tutorVaultItems.tutorUserId,
        title: tutorVaultItems.title,
        description: tutorVaultItems.description,
        fileUrl: tutorVaultItems.fileUrl,
        mimeType: tutorVaultItems.mimeType,
        isPublic: tutorVaultItems.isPublic,
        priceCents: tutorVaultItems.priceCents,
        purchaseCount: tutorVaultItems.purchaseCount,
        createdAt: tutorVaultItems.createdAt,
        purchaseStatus: vaultPurchases.status,
      })
      .from(tutorVaultItems)
      .leftJoin(vaultPurchases, and(eq(vaultPurchases.itemId, tutorVaultItems.id), buyerId ? eq(vaultPurchases.buyerId, buyerId) : sql`false`))
      .where(and(eq(tutorVaultItems.tutorUserId, tutorUserId), eq(tutorVaultItems.isPublic, true), eq(tutorVaultItems.priceCents, 0)))
      .orderBy(desc(tutorVaultItems.createdAt));

    return rows.map((row) => ({
      ...row,
      purchased: row.priceCents === 0 || row.purchaseStatus === 'confirmed',
    }));
  }

  async deleteVaultItem(tutorUserId: string, itemId: string) {
    const [item] = await db
      .select()
      .from(tutorVaultItems)
      .where(and(eq(tutorVaultItems.id, itemId), eq(tutorVaultItems.tutorUserId, tutorUserId)))
      .limit(1);

    if (!item) throw new NotFoundException('Study note not found or access denied.');

    await db.delete(tutorVaultItems).where(eq(tutorVaultItems.id, itemId));
    return { success: true };
  }

  async createPurchase(buyerId: string, itemId: string) {
    const [item] = await db.select().from(tutorVaultItems).where(eq(tutorVaultItems.id, itemId)).limit(1);
    if (!item) throw new NotFoundException('Study note not found.');
    if (item.priceCents === 0) return { status: 'confirmed' as const, purchaseId: null };

    const [existing] = await db
      .select()
      .from(vaultPurchases)
      .where(and(eq(vaultPurchases.itemId, itemId), eq(vaultPurchases.buyerId, buyerId)))
      .limit(1);

    if (existing) return { status: existing.status, purchaseId: existing.id };

    const purchaseId = randomUUID();
    const [created] = await db
      .insert(vaultPurchases)
      .values({ id: purchaseId, itemId, buyerId, status: 'pending' })
      .returning();
    return { status: created.status, purchaseId: created.id };
  }

  async confirmPurchase(tutorUserId: string, purchaseId: string) {
    const [purchase] = await db
      .select({ purchase: vaultPurchases, item: tutorVaultItems })
      .from(vaultPurchases)
      .innerJoin(tutorVaultItems, eq(tutorVaultItems.id, vaultPurchases.itemId))
      .where(eq(vaultPurchases.id, purchaseId))
      .limit(1);

    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.item.tutorUserId !== tutorUserId) throw new ForbiddenException('Access denied.');

    await db
      .update(vaultPurchases)
      .set({ status: 'confirmed', confirmedAt: new Date() })
      .where(eq(vaultPurchases.id, purchaseId));

    await db
      .update(tutorVaultItems)
      .set({ purchaseCount: sql`${tutorVaultItems.purchaseCount} + 1` })
      .where(eq(tutorVaultItems.id, purchase.item.id));

    return { success: true };
  }

  async listPendingPurchases(tutorUserId: string) {
    return db
      .select({
        purchaseId: vaultPurchases.id,
        itemId: vaultPurchases.itemId,
        buyerId: vaultPurchases.buyerId,
        status: vaultPurchases.status,
        createdAt: vaultPurchases.createdAt,
        title: tutorVaultItems.title,
        priceCents: tutorVaultItems.priceCents,
      })
      .from(vaultPurchases)
      .innerJoin(tutorVaultItems, eq(tutorVaultItems.id, vaultPurchases.itemId))
      .where(and(eq(tutorVaultItems.tutorUserId, tutorUserId), eq(vaultPurchases.status, 'pending')))
      .orderBy(desc(vaultPurchases.createdAt));
  }

  async downloadVaultFile(itemId: string, buyerId?: string) {
    const [item] = await db
      .select()
      .from(tutorVaultItems)
      .where(eq(tutorVaultItems.id, itemId))
      .limit(1);

    if (!item) throw new NotFoundException('Study note not found.');

    if (item.priceCents > 0) {
      if (!buyerId) throw new ForbiddenException('Sign in to access this item.');
      const [purchase] = await db
        .select()
        .from(vaultPurchases)
        .where(and(eq(vaultPurchases.itemId, itemId), eq(vaultPurchases.buyerId, buyerId), eq(vaultPurchases.status, 'confirmed')))
        .limit(1);
      if (!purchase) throw new ForbiddenException('Purchase not confirmed yet.');
    }

    const ext = item.fileUrl.includes('.') ? item.fileUrl.slice(item.fileUrl.lastIndexOf('.')) : '.pdf';
    const filePath = join(this.uploadRoot, 'tutor-vault', `${itemId}${ext}`);
    const bytes = await readFile(filePath);
    return { bytes, fileName: `${item.title.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`, mimeType: item.mimeType };
  }
}
