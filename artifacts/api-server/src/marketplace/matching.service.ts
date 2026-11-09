import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { db, tutorProfiles, tutorSubjects, subjects, users, tutorAvailabilityWindows, bookingSlots, waitlistEntries, reviews, tutorReviewSkills } from '@workspace/db';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';

@Injectable()
export class MatchingService {
  // Generate open slots for a tutor over the next N days based on availability windows
  async generateSlots(tutorId: string, daysAhead = 14) {
    const windows = await db.select().from(tutorAvailabilityWindows).where(eq(tutorAvailabilityWindows.tutorId, tutorId));
    const tutor = await db.select().from(tutorProfiles).where(eq(tutorProfiles.userId, tutorId)).limit(1);
    if (!tutor.length) throw new NotFoundException('Tutor not found.');
    const rate = tutor[0].hourlyRateCents;

    const now = new Date();
    const slots: { tutorId: string; startAt: Date; endAt: Date; priceCents: number }[] = [];

    for (let d = 0; d < daysAhead; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const dow = date.getDay();
      const dayWindows = windows.filter((w) => w.dayOfWeek === dow && w.isRecurring);
      for (const w of dayWindows) {
        const [sh, sm] = w.startTime.split(':').map(Number);
        const [eh, em] = w.endTime.split(':').map(Number);
        const start = new Date(date);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(date);
        end.setHours(eh, em, 0, 0);
        // Create 60-min slots
        let cursor = new Date(start);
        while (cursor.getTime() + 3600000 <= end.getTime()) {
          const slotEnd = new Date(cursor.getTime() + 3600000);
          if (cursor.getTime() > now.getTime()) {
            slots.push({ tutorId, startAt: new Date(cursor), endAt: slotEnd, priceCents: rate });
          }
          cursor = new Date(cursor.getTime() + 3600000);
        }
      }
    }

    // Insert, skip duplicates
    for (const s of slots) {
      try {
        await db.insert(bookingSlots).values({
          id: randomUUID(), tutorId: s.tutorId, startAt: s.startAt, endAt: s.endAt, priceCents: s.priceCents, status: 'open',
        }).onConflictDoNothing();
      } catch { /* skip */ }
    }

    return slots.length;
  }

  async getOpenSlots(tutorId: string) {
    const now = new Date();
    return db.select().from(bookingSlots)
      .where(and(eq(bookingSlots.tutorId, tutorId), eq(bookingSlots.status, 'open'), gte(bookingSlots.startAt, now)))
      .orderBy(bookingSlots.startAt);
  }

  async matchTutors(params: { subject?: string; level?: string; budget?: number; date?: string; time?: string }) {
    let tutors = await db.select().from(tutorProfiles).where(eq(tutorProfiles.approval, 'approved'));

    // Filter by subject
    if (params.subject) {
      const subjectRows = await db.select().from(subjects).where(eq(subjects.name, params.subject)).limit(1);
      if (subjectRows.length) {
        const tutorSubs = await db.select().from(tutorSubjects).where(eq(tutorSubjects.subjectId, subjectRows[0].id));
        const tutorIds = new Set(tutorSubs.map((ts) => ts.tutorId));
        tutors = tutors.filter((t) => tutorIds.has(t.userId));
      }
    }

    // Score each tutor
    const scored = await Promise.all(tutors.map(async (tutor) => {
      let score = 0;
      const reasons: string[] = [];

      // Subject overlap (0.4)
      if (params.subject) {
        const ts = await db.select().from(tutorSubjects).where(eq(tutorSubjects.tutorId, tutor.userId));
        const subjectMatch = ts.length > 0;
        if (subjectMatch) { score += 0.4; reasons.push(`Teaches ${params.subject}`); }
      } else {
        score += 0.2; // partial credit for no subject filter
      }

      // Rating (0.25) — use review count as proxy
      const reviewRows = await db.select().from(reviews).where(eq(reviews.tutorId, tutor.userId));
      const avgRating = reviewRows.length > 0
        ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length
        : 3.5;
      score += (avgRating / 5) * 0.25;
      if (reviewRows.length >= 3) reasons.push(`${avgRating.toFixed(1)}/5 from ${reviewRows.length} reviews`);

      // Response time (0.15)
      if (tutor.responseTimeMinutes !== null && tutor.responseTimeMinutes < 120) {
        score += 0.15;
        reasons.push(`Responds in ~${Math.round(tutor.responseTimeMinutes / 60)}h`);
      } else {
        score += 0.05;
      }

      // Price fit (0.05)
      if (params.budget && tutor.hourlyRateCents <= params.budget * 100) {
        score += 0.05;
        reasons.push('Within budget');
      }

      // Availability overlap (0.15) — check if tutor has open slots
      const openSlots = await db.select().from(bookingSlots)
        .where(and(eq(bookingSlots.tutorId, tutor.userId), eq(bookingSlots.status, 'open')))
        .limit(1);
      if (openSlots.length > 0) { score += 0.15; reasons.push('Has open slots'); }

      return {
        tutor,
        score: Math.round(score * 100) / 100,
        reasons,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: reviewRows.length,
      };
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  async joinWaitlist(tutorId: string, learnerId: string, subject?: string) {
    const [entry] = await db.insert(waitlistEntries).values({
      id: randomUUID(), tutorId, learnerId, subject: subject || null,
    }).onConflictDoNothing().returning();
    return entry || { tutorId, learnerId, subject, alreadyExists: true };
  }

  async getWaitlist(tutorId: string) {
    return db.select().from(waitlistEntries).where(eq(waitlistEntries.tutorId, tutorId));
  }
}
