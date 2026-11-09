import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import {
  db,
  microBounties,
  bountySolutions,
  tutorProfiles,
  users,
} from '@workspace/db';

@Injectable()
export class BountyService {
  private readonly uploadRoot = resolve(process.env.UPLOAD_DIR ?? '.local/uploads');

  constructor() {
    mkdir(join(this.uploadRoot, 'bounty-images'), { recursive: true }).catch(() => undefined);
  }

  async createBounty(
    learnerId: string,
    params: {
      courseTag: string;
      description: string;
      bountyAmountCents: number;
      file?: Express.Multer.File;
    },
  ) {
    if (!params.courseTag || params.courseTag.trim().length < 2) {
      throw new BadRequestException('Course tag is required.');
    }
    if (!params.description || params.description.trim().length < 5) {
      throw new BadRequestException('Description must be at least 5 characters.');
    }
    if (!Number.isFinite(params.bountyAmountCents) || params.bountyAmountCents < 200 || params.bountyAmountCents > 500) {
      throw new BadRequestException('Bounty must be between $2 and $5.');
    }

    const id = randomUUID();
    let imageUrl: string | null = null;

    if (params.file) {
      const destDir = join(this.uploadRoot, 'bounty-images');
      await mkdir(destDir, { recursive: true });
      const ext = params.file.originalname.includes('.')
        ? params.file.originalname.slice(params.file.originalname.lastIndexOf('.'))
        : '.jpg';
      const destPath = join(destDir, `${id}${ext}`);
      if (params.file.buffer) {
        await writeFile(destPath, params.file.buffer);
      } else if ((params.file as any).path) {
        const bytes = await readFile((params.file as any).path);
        await writeFile(destPath, bytes);
      } else {
        throw new BadRequestException('Invalid image upload.');
      }
      imageUrl = `/api/marketplace/bounties/${id}/image`;
    }

    const [created] = await db
      .insert(microBounties)
      .values({
        id,
        learnerId,
        courseTag: params.courseTag.trim().slice(0, 80),
        description: params.description.trim().slice(0, 1000),
        imageUrl,
        bountyAmountCents: params.bountyAmountCents,
        status: 'open',
      })
      .returning();

    return created;
  }

  async listOpenBounties() {
    const rows = await db
      .select({
        id: microBounties.id,
        learnerId: microBounties.learnerId,
        courseTag: microBounties.courseTag,
        description: microBounties.description,
        imageUrl: microBounties.imageUrl,
        bountyAmountCents: microBounties.bountyAmountCents,
        status: microBounties.status,
        createdAt: microBounties.createdAt,
        learnerName: users.firstName,
      })
      .from(microBounties)
      .innerJoin(users, eq(users.id, microBounties.learnerId))
      .where(eq(microBounties.status, 'open'))
      .orderBy(desc(microBounties.createdAt));
    return rows;
  }

  async claimBounty(tutorUserId: string, bountyId: string) {
    const [bounty] = await db
      .select()
      .from(microBounties)
      .where(eq(microBounties.id, bountyId))
      .limit(1);

    if (!bounty) throw new NotFoundException('Bounty not found.');
    if (bounty.status !== 'open') throw new BadRequestException('Bounty is no longer available.');

    const [updated] = await db
      .update(microBounties)
      .set({ status: 'claimed', claimedByTutorId: tutorUserId, updatedAt: new Date() })
      .where(and(eq(microBounties.id, bountyId), eq(microBounties.status, 'open')))
      .returning();

    if (!updated) throw new BadRequestException('Bounty was just claimed by another tutor.');
    return updated;
  }

  async submitSolution(
    tutorUserId: string,
    bountyId: string,
    params: { description: string; file?: Express.Multer.File; voiceNoteUrl?: string },
  ) {
    const [bounty] = await db
      .select()
      .from(microBounties)
      .where(eq(microBounties.id, bountyId))
      .limit(1);

    if (!bounty) throw new NotFoundException('Bounty not found.');
    if (bounty.claimedByTutorId !== tutorUserId) throw new ForbiddenException('You did not claim this bounty.');
    if (bounty.status === 'solved') throw new BadRequestException('Bounty already solved.');

    if (!params.description || params.description.trim().length < 3) {
      throw new BadRequestException('Solution description is required.');
    }

    const solutionId = randomUUID();
    let imageUrl: string | null = null;

    if (params.file) {
      const destDir = join(this.uploadRoot, 'bounty-images');
      await mkdir(destDir, { recursive: true });
      const ext = params.file.originalname.includes('.')
        ? params.file.originalname.slice(params.file.originalname.lastIndexOf('.'))
        : '.jpg';
      const destPath = join(destDir, `solution-${solutionId}${ext}`);
      if (params.file.buffer) {
        await writeFile(destPath, params.file.buffer);
      } else if ((params.file as any).path) {
        const bytes = await readFile((params.file as any).path);
        await writeFile(destPath, bytes);
      }
      imageUrl = `/api/marketplace/bounties/solution-image/${solutionId}`;
    }

    const [solution] = await db
      .insert(bountySolutions)
      .values({
        id: solutionId,
        bountyId,
        tutorId: tutorUserId,
        description: params.description.trim().slice(0, 2000),
        imageUrl,
        voiceNoteUrl: params.voiceNoteUrl ?? null,
      })
      .returning();

    await db
      .update(microBounties)
      .set({ status: 'solved', solvedAt: new Date(), updatedAt: new Date() })
      .where(eq(microBounties.id, bountyId));

    return solution;
  }

  async listSolutions(bountyId: string) {
    return db
      .select()
      .from(bountySolutions)
      .where(eq(bountySolutions.bountyId, bountyId))
      .orderBy(desc(bountySolutions.createdAt));
  }

  async getBountyImage(id: string) {
    // id can be bounty id or solution id (prefixed)
    const isSolution = id.startsWith('solution-');
    const realId = isSolution ? id.replace('solution-', '') : id;
    const dir = join(this.uploadRoot, 'bounty-images');
    // try common extensions
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      try {
        const bytes = await readFile(join(dir, `${isSolution ? `solution-${realId}` : realId}${ext}`));
        return { bytes, mimeType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg' };
      } catch {
        // continue
      }
    }
    throw new NotFoundException('Image not found.');
  }
}