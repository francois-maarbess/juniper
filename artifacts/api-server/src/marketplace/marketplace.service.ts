import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and, asc, authSessions, bookings, conversations, db, desc, emailOutbox, eq, gt, ilike, inArray, isNull, learnerProfiles, messageAttachments, messages, offers, offerMessages, or, requestAttachments, sql,
  reviews, studyRequests, subjects, tutorApplications, tutorApplicationDocuments, tutorProfiles, tutorSubjects, userNotifications, userPushTokens, users,
  universityCourses, tutorCourses, availabilitySlots, tutorTags,
} from '@workspace/db';
import { MarketplaceRealtimeGateway } from './marketplace-realtime.gateway.js';
import { TutorDocumentStorage } from './tutor-document-storage.js';

type StudyWindow = 'Weekday mornings' | 'Weekday evenings' | 'Weekend';
const studyWindows: Record<StudyWindow, [number, number]> = {
  'Weekday mornings': [8, 12],
  'Weekday evenings': [17, 22],
  Weekend: [10, 18],
};
const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();

function isPublishableTutorProfile(displayName: string | null, headline: string | null, biography: string | null, educationSummary: string | null) {
  const usable = (value: string | null, min: number, max: number) => {
    if (!value || value.trim().length < min || value.trim().length > max) return false;
    if (/(.)\1{5,}/iu.test(value)) return false;
    return true;
  };
  return usable(displayName, 2, 80) && usable(headline, 8, 140) && usable(biography, 40, 3000)
    && usable(educationSummary, 10, 1000);
}

function localParts(date: Date, timeZone: string) {
  let formatter = timeZoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    timeZoneFormatters.set(timeZone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day, hour);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = localParts(new Date(guess), timeZone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += target - represented;
  }
  return guess;
}

function matchesStudyTime(
  tutorWindows: string[], tutorTimezone: string, learnerWindows: string[], learnerTimezone: string,
) {
  if (!learnerWindows.length) return true;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = Date.now() - 2 * 24 * 60 * 60 * 1000;
  for (let offset = 0; offset < 16; offset++) {
    const date = new Date(start + offset * 24 * 60 * 60 * 1000);
    const tutorDate = localParts(date, tutorTimezone);
    const learnerDate = localParts(date, learnerTimezone);
    const tutorWeekend = days.indexOf(String(tutorDate.weekday)) % 7 === 0 || String(tutorDate.weekday) === 'Sat';
    const learnerWeekend = days.indexOf(String(learnerDate.weekday)) % 7 === 0 || String(learnerDate.weekday) === 'Sat';
    for (const tutorWindow of tutorWindows) {
      if (!(tutorWindow in studyWindows)) continue;
      for (const learnerWindow of learnerWindows) {
        if (!(learnerWindow in studyWindows)) continue;
        const tutorIsWeekendWindow = tutorWindow === 'Weekend';
        const learnerIsWeekendWindow = learnerWindow === 'Weekend';
        if (tutorIsWeekendWindow !== tutorWeekend || learnerIsWeekendWindow !== learnerWeekend) continue;
        const [tutorStartHour, tutorEndHour] = studyWindows[tutorWindow as StudyWindow];
        const [learnerStartHour, learnerEndHour] = studyWindows[learnerWindow as StudyWindow];
        const interval = (parts: Record<string, string>, zone: string, from: number, to: number) => ({
          start: zonedTimeToUtc(Number(parts.year), Number(parts.month), Number(parts.day), from, zone),
          end: zonedTimeToUtc(Number(parts.year), Number(parts.month), Number(parts.day), to, zone),
        });
        const tutor = interval(tutorDate, tutorTimezone, tutorStartHour, tutorEndHour);
        const learner = interval(learnerDate, learnerTimezone, learnerStartHour, learnerEndHour);
        if (tutor.start < learner.end && learner.start < tutor.end) return true;
      }
    }
  }
  return false;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(MarketplaceRealtimeGateway) private readonly realtime: MarketplaceRealtimeGateway,
    @Inject(TutorDocumentStorage) private readonly storage: TutorDocumentStorage,
  ) {}

  private async notify(userId: string, kind: string, title: string, body: string, targetPath: string) {
    const [notification] = await db.insert(userNotifications).values({ userId, kind, title, body, targetPath }).returning();
    if (notification) this.dispatchNotification(userId, notification);
  }

  dispatchNotification(userId: string, notification: { title: string; body: string; targetPath: string | null }) {
    this.realtime.emitUser(userId, 'notification:new', notification);
    void this.sendPush(userId, notification.title, notification.body, notification.targetPath ?? '');
  }

  private async sendPush(userId: string, title: string, body: string, targetPath: string) {
    try {
      const tokens = await db.select({ id: userPushTokens.id, token: userPushTokens.token })
        .from(userPushTokens).where(and(eq(userPushTokens.userId, userId), isNull(userPushTokens.disabledAt)));
      if (!tokens.length) return;
      for (let offset = 0; offset < tokens.length; offset += 100) {
        const batch = tokens.slice(offset, offset + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch.map(({ token }) => ({ to: token, title, body, data: { targetPath }, sound: 'default' }))),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) continue;
        const result = await response.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
        const invalid = batch.filter((_, index) => result?.data?.[index]?.details?.error === 'DeviceNotRegistered');
        if (invalid.length) await db.update(userPushTokens).set({ disabledAt: new Date() })
          .where(inArray(userPushTokens.id, invalid.map((item) => item.id)));
      }
    } catch {
      // In-app and realtime notifications remain available if the push provider is temporarily unreachable.
    }
  }

  async registerPushToken(userId: string, token: string, platform: string) {
    await this.requireVerifiedUser(userId);
    if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token) || !['ios', 'android'].includes(platform)) {
      throw new BadRequestException('Register a valid Juniper mobile notification token.');
    }
    await db.insert(userPushTokens).values({ userId, token, platform, lastSeenAt: new Date() }).onConflictDoUpdate({
      target: userPushTokens.token,
      set: { userId, platform, disabledAt: null, lastSeenAt: new Date() },
    });
    return { registered: true };
  }

  async unregisterPushToken(userId: string, token: string) {
    await this.requireVerifiedUser(userId);
    await db.update(userPushTokens).set({ disabledAt: new Date() }).where(and(
      eq(userPushTokens.userId, userId), eq(userPushTokens.token, token), isNull(userPushTokens.disabledAt),
    ));
    return { removed: true };
  }

  private async requireAdministrator(userId: string) {
    const [user] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.isAdmin) {
      throw new ForbiddenException('Administrator access is required.');
    }
  }

  async isAdministrator(userId: string) {
    const [user] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return Boolean(user?.isAdmin);
  }

  async listTutorApplicationsForReview(userId: string) {
    await this.requireAdministrator(userId);
    return db.select({
      userId: tutorProfiles.userId, displayName: tutorProfiles.displayName, headline: tutorProfiles.headline,
      biography: tutorProfiles.biography, educationSummary: tutorProfiles.educationSummary,
      hourlyRateCents: tutorProfiles.hourlyRateCents, availability: tutorProfiles.availability,
      approval: tutorProfiles.approval, createdAt: tutorProfiles.createdAt,
      reviewedAt: tutorProfiles.reviewedAt, reviewNote: tutorProfiles.reviewNote,
      email: users.email, firstName: users.firstName, lastName: users.lastName,
      subjects: sql<string[]>`coalesce(array_agg(distinct ${subjects.name}) filter (where ${subjects.name} is not null), '{}')`,
    }).from(tutorProfiles).innerJoin(users, eq(users.id, tutorProfiles.userId))
      .leftJoin(tutorSubjects, eq(tutorSubjects.tutorId, tutorProfiles.userId))
      .leftJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(inArray(tutorProfiles.approval, ['pending', 'rejected', 'suspended']))
      .groupBy(tutorProfiles.userId, users.id)
      .orderBy(asc(tutorProfiles.createdAt)).limit(100);
  }

  async reviewTutorApplication(adminId: string, tutorId: string, decision: 'approved' | 'rejected' | 'suspended', note: string, qualificationsReviewed = false) {
    await this.requireAdministrator(adminId);
    const [application] = await db.select({ status: tutorApplications.status }).from(tutorApplications)
      .where(eq(tutorApplications.userId, tutorId)).limit(1);
    if (decision === 'approved' && (!application || !['in_review', 'submitted'].includes(application.status))) {
      throw new ConflictException('Only a submitted tutor application can be approved.');
    }
    if (decision === 'approved' && !qualificationsReviewed) throw new BadRequestException('Confirm identity and qualification checks before approving this tutor.');
    if (decision === 'approved') {
      const docs = await db.select({ category: tutorApplicationDocuments.category, reviewStatus: tutorApplicationDocuments.reviewStatus })
        .from(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.userId, tutorId));
      if (!docs.some((d) => d.category === 'transcript' && d.reviewStatus === 'verified') ||
        !docs.some((d) => d.category === 'degree_certificate' && d.reviewStatus === 'verified')) {
        throw new BadRequestException('Verify a transcript and degree certificate before approving this tutor.');
      }
    }
    if (note.length > 2000 || (decision !== 'approved' && note.trim().length < 10)) {
      throw new BadRequestException('Add a clear review note when declining or suspending an application.');
    }
    const [profile] = await db.select({ userId: tutorProfiles.userId, approval: tutorProfiles.approval })
      .from(tutorProfiles).where(eq(tutorProfiles.userId, tutorId)).limit(1);
    if (!profile) throw new NotFoundException('Tutor application not found.');
    if (profile.approval !== 'pending' && profile.approval !== 'rejected' && profile.approval !== 'suspended') {
      throw new ConflictException('This application is not awaiting review.');
    }
    const [updated] = await db.update(tutorProfiles).set({
      approval: decision, reviewedAt: new Date(), reviewedBy: adminId,
      reviewNote: note.trim() || (decision === 'approved' ? 'Identity and qualification checks completed by an administrator.' : null), updatedAt: new Date(),
    }).where(eq(tutorProfiles.userId, tutorId)).returning({ userId: tutorProfiles.userId });
    if (!updated) throw new NotFoundException('Tutor application not found.');
    await db.update(tutorApplications).set({ status: decision, reviewedBy: adminId, reviewedAt: new Date(),
      applicantMessage: note.trim() || null, updatedAt: new Date() }).where(eq(tutorApplications.userId, tutorId));
    await this.notify(tutorId, `tutor_application_${decision}`, `Tutor application ${decision}`, decision === 'approved'
      ? 'Your tutor profile has been approved. You can now respond to matching learner requests.'
      : note.trim(), '/(tabs)/profile');
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, tutorId)).limit(1);
    if (account?.email) await db.insert(emailOutbox).values({
      recipient: account.email,
      subject: decision === 'approved' ? 'Your Juniper tutor profile is approved' : 'An update on your Juniper tutor application',
      textBody: `Hello,\n\n${decision === 'approved' ? 'Your tutor application has been approved. You can now respond to matching learner requests.' : `Our team has an update about your tutor application: ${note.trim()}`}\n\nSign in to Juniper to view your tutor setup: ${process.env.APP_PUBLIC_URL ?? 'http://localhost:8081'}/become-tutor\n\nThe Juniper team`,
    });
    return { status: decision, reviewedAt: new Date().toISOString() };
  }

  async listNotifications(userId: string) {
    await this.requireVerifiedUser(userId);
    return db.select({
      id: userNotifications.id, kind: userNotifications.kind, title: userNotifications.title,
      body: userNotifications.body, targetPath: userNotifications.targetPath,
      readAt: userNotifications.readAt, createdAt: userNotifications.createdAt,
    }).from(userNotifications).where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt)).limit(50);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.requireVerifiedUser(userId);
    const [updated] = await db.update(userNotifications).set({ readAt: new Date() }).where(and(
      eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId), isNull(userNotifications.readAt),
    )).returning({ id: userNotifications.id });
    if (!updated) throw new NotFoundException('Notification not found.');
    return { read: true };
  }
  private async requireVerifiedUser(userId: string) {
    const [user] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users)
      .where(and(eq(users.id, userId), isNull(users.disabledAt))).limit(1);
    if (!user) throw new NotFoundException('Account not found.');
    if (!user.emailVerifiedAt) throw new ForbiddenException('Verify your email before using marketplace features.');
  }

  async listSubjects() {
    return db.select({ id: subjects.id, name: subjects.name, slug: subjects.slug, category: subjects.category })
      .from(subjects).where(eq(subjects.active, true)).orderBy(asc(subjects.category), asc(subjects.name));
  }

  async listTutors(filters: { subject?: string; level?: string; tutorId?: string; courseCode?: string; university?: string } = {}) {
    const conditions = [
      and(
        eq(tutorProfiles.approval, 'approved' as const),
        or(
          eq(tutorProfiles.subscriptionPaid, true),
          gt(tutorProfiles.freePeriodEndsAt, new Date()),
        ),
      )!,
      eq(subjects.active, true),
    ];
    if (filters.subject) conditions.push(or(eq(subjects.name, filters.subject), sql`exists (select 1 from unnest(${tutorProfiles.customSubjects}) as custom_subject where lower(custom_subject) = lower(${filters.subject}))`) as typeof conditions[number]);
    if (filters.level) conditions.push(sql`(${tutorProfiles.levels} @> ARRAY['all']::text[] OR ${tutorProfiles.levels} @> ARRAY[${filters.level}]::text[])` as typeof conditions[number]);
    if (filters.tutorId) conditions.push(eq(tutorProfiles.userId, filters.tutorId) as typeof conditions[number]);
    if (filters.courseCode) {
      conditions.push(or(sql`exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${tutorProfiles.userId} and (uc.code ilike ${'%' + filters.courseCode + '%'} or uc.name ilike ${'%' + filters.courseCode + '%'}))`, sql`exists (select 1 from unnest(${tutorProfiles.customCourses}) as custom_course where custom_course ilike ${'%' + filters.courseCode + '%'})`) as typeof conditions[number]);
    }
    if (filters.university && filters.university !== 'ALL') {
      conditions.push(or(sql`exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${tutorProfiles.userId} and uc.university ilike ${filters.university})`, sql`exists (select 1 from unnest(${tutorProfiles.customUniversities}) as custom_university where lower(custom_university) = lower(${filters.university}))`) as typeof conditions[number]);
    }
    const rows = await db.select({
      id: tutorProfiles.userId,
      displayName: tutorProfiles.displayName,
      headline: tutorProfiles.headline,
      biography: tutorProfiles.biography,
      hourlyRateCents: tutorProfiles.hourlyRateCents,
      yearsExperience: tutorProfiles.yearsExperience,
      availability: tutorProfiles.availability,
      timezone: tutorProfiles.timezone,
      educationSummary: tutorProfiles.educationSummary,
      customSubjects: tutorProfiles.customSubjects,
      customCourses: tutorProfiles.customCourses,
      customUniversities: tutorProfiles.customUniversities,
      languages: sql<string[]>`coalesce((select ta.languages from tutor_applications ta where ta.user_id = ${tutorProfiles.userId}), '{}'::text[])`,
      levels: tutorProfiles.levels,
      averageRating: sql<number>`coalesce((select round(avg(r.rating)::numeric, 1)::float from reviews r where r.tutor_id = ${tutorProfiles.userId}), 0)`,
      reviewCount: sql<number>`(select count(*)::int from reviews r where r.tutor_id = ${tutorProfiles.userId})`,
      completedSessions: sql<number>`(select count(*)::int from bookings b where b.tutor_id = ${tutorProfiles.userId} and b.status = 'completed')`,
      responseTimeMinutes: sql<number | null>`(select percentile_cont(0.5) within group (order by extract(epoch from (o.created_at - r.created_at)) / 60)::int
        from offers o inner join study_requests r on r.id = o.request_id
        where o.tutor_id = ${tutorProfiles.userId} and o.created_at >= now() - interval '90 days')`,
      responseSampleCount: sql<number>`(select count(*)::int from offers o
        where o.tutor_id = ${tutorProfiles.userId} and o.created_at >= now() - interval '90 days')`,
      courses: sql<Array<{ id: string; university: string; code: string; name: string }>>`coalesce((
        select json_agg(json_build_object('id', uc.id, 'university', uc.university, 'code', uc.code, 'name', uc.name))
        from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id
        where tc.tutor_id = ${tutorProfiles.userId} and uc.active = true
      ), '[]'::json)`,
      subject: subjects.name,
    }).from(tutorProfiles)
      .innerJoin(tutorSubjects, eq(tutorSubjects.tutorId, tutorProfiles.userId))
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(and(...conditions))
      .orderBy(
        desc(sql`coalesce((select round(avg(r.rating)::numeric, 1)::float from reviews r where r.tutor_id = ${tutorProfiles.userId}), 0)`),
        desc(sql`(select count(*) from reviews r where r.tutor_id = ${tutorProfiles.userId})`),
        asc(sql`case when (select count(*) from offers o where o.tutor_id = ${tutorProfiles.userId} and o.created_at >= now() - interval '90 days') = 0 then 1 else 0 end`),
        asc(sql`(select round(avg(extract(epoch from (o.created_at - r.created_at)) / 60))
          from offers o inner join study_requests r on r.id = o.request_id
          where o.tutor_id = ${tutorProfiles.userId} and o.created_at >= now() - interval '90 days')`),
        desc(sql`(select count(*) from bookings b where b.tutor_id = ${tutorProfiles.userId} and b.status = 'completed')`),
        asc(tutorProfiles.displayName),
      );
    return rows.filter((row) => isPublishableTutorProfile(row.displayName, row.headline, row.biography, row.educationSummary));
  }

  async getPublicTutorProfile(tutorId: string) {
    const rows = await this.listTutors({ tutorId });
    if (!rows.length) throw new NotFoundException('This approved tutor profile is not available.');
    const { subject: _subject, ...profile } = rows[0]!;
    const [courses, availabilitySlotsList] = await Promise.all([
      this.getTutorCourses(tutorId),
      this.getTutorAvailabilitySlots(tutorId),
    ]);
    return {
      ...profile,
      subjects: [...new Set(rows.map((row) => row.subject))],
      courses,
      availabilitySlots: availabilitySlotsList,
    };
  }

  async getTutorProfile(userId: string) {
    const [profile] = await db.select({
      displayName: tutorProfiles.displayName, headline: tutorProfiles.headline,
      biography: tutorProfiles.biography, hourlyRateCents: tutorProfiles.hourlyRateCents,
      educationSummary: tutorProfiles.educationSummary, levels: tutorProfiles.levels,
      customSubjects: tutorProfiles.customSubjects, customCourses: tutorProfiles.customCourses, customUniversities: tutorProfiles.customUniversities,
      availability: tutorProfiles.availability, timezone: tutorProfiles.timezone, approval: tutorProfiles.approval,
      reviewNote: tutorProfiles.reviewNote, reviewedAt: tutorProfiles.reviewedAt,
    }).from(tutorProfiles).where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile) return null;
    const [selected, courses, slots] = await Promise.all([
      db.select({ id: subjects.id, name: subjects.name })
        .from(tutorSubjects).innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
        .where(eq(tutorSubjects.tutorId, userId)).orderBy(asc(subjects.name)),
      this.getTutorCourses(userId),
      this.getTutorAvailabilitySlots(userId),
    ]);
    return { ...profile, subjects: selected, courses, availabilitySlots: slots };
  }

  async searchUniversityCourses(query?: string, university?: string) {
    const conditions = [eq(universityCourses.active, true)];
    if (university && university !== 'ALL') {
      conditions.push(eq(universityCourses.university, university.toUpperCase()));
    }
    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(universityCourses.code, q),
          ilike(universityCourses.name, q),
          ilike(universityCourses.department, q),
        )!,
      );
    }
    return db
      .select({
        id: universityCourses.id,
        university: universityCourses.university,
        code: universityCourses.code,
        name: universityCourses.name,
        department: universityCourses.department,
        credits: universityCourses.credits,
      })
      .from(universityCourses)
      .where(and(...conditions))
      .orderBy(asc(universityCourses.university), asc(universityCourses.code))
      .limit(60);
  }

  async getTutorCourses(tutorId: string) {
    return db
      .select({
        id: universityCourses.id,
        university: universityCourses.university,
        code: universityCourses.code,
        name: universityCourses.name,
        department: universityCourses.department,
        credits: universityCourses.credits,
      })
      .from(tutorCourses)
      .innerJoin(universityCourses, eq(universityCourses.id, tutorCourses.courseId))
      .where(eq(tutorCourses.tutorId, tutorId))
      .orderBy(asc(universityCourses.university), asc(universityCourses.code));
  }

  async updateTutorCourses(tutorId: string, courseIds: string[]) {
    await this.requireVerifiedUser(tutorId);
    const [tutor] = await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, tutorId)).limit(1);
    if (!tutor) throw new NotFoundException('Tutor profile not found.');

    const uniqueIds = [...new Set(courseIds.filter(Boolean))];
    if (uniqueIds.length > 25) {
      throw new BadRequestException('You can select up to 25 university courses.');
    }

    if (uniqueIds.length > 0) {
      const validCourses = await db
        .select({ id: universityCourses.id })
        .from(universityCourses)
        .where(and(inArray(universityCourses.id, uniqueIds), eq(universityCourses.active, true)));
      if (validCourses.length !== uniqueIds.length) {
        throw new BadRequestException('Some chosen course codes are invalid or inactive.');
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(tutorCourses).where(eq(tutorCourses.tutorId, tutorId));
      if (uniqueIds.length > 0) {
        await tx.insert(tutorCourses).values(
          uniqueIds.map((courseId) => ({ tutorId, courseId })),
        );
      }
    });

    return this.getTutorCourses(tutorId);
  }

  async getTutorAvailabilitySlots(tutorId: string) {
    return db
      .select({
        id: availabilitySlots.id,
        dayOfWeek: availabilitySlots.dayOfWeek,
        startTime: availabilitySlots.startTime,
        endTime: availabilitySlots.endTime,
        isActive: availabilitySlots.isActive,
      })
      .from(availabilitySlots)
      .where(and(eq(availabilitySlots.tutorId, tutorId), eq(availabilitySlots.isActive, true)))
      .orderBy(
        sql`case ${availabilitySlots.dayOfWeek}
          when 'monday' then 1
          when 'tuesday' then 2
          when 'wednesday' then 3
          when 'thursday' then 4
          when 'friday' then 5
          when 'saturday' then 6
          when 'sunday' then 7
          else 8 end`,
        asc(availabilitySlots.startTime),
      );
  }

  async updateTutorAvailabilitySlots(
    tutorId: string,
    slots: Array<{
      dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
      startTime: string;
      endTime: string;
    }>,
  ) {
    await this.requireVerifiedUser(tutorId);
    const [tutor] = await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, tutorId)).limit(1);
    if (!tutor) throw new NotFoundException('Tutor profile not found.');

    const validDays = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (const slot of slots) {
      if (!validDays.has(slot.dayOfWeek)) {
        throw new BadRequestException(`Invalid day of week: ${slot.dayOfWeek}`);
      }
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        throw new BadRequestException('Slot times must be in 24-hour HH:mm format.');
      }
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException(`Start time (${slot.startTime}) must be before end time (${slot.endTime}).`);
      }
    }

    if (slots.length > 50) {
      throw new BadRequestException('Maximum 50 availability slots allowed.');
    }

    await db.transaction(async (tx) => {
      await tx.delete(availabilitySlots).where(eq(availabilitySlots.tutorId, tutorId));
      if (slots.length > 0) {
        await tx.insert(availabilitySlots).values(
          slots.map((s) => ({
            tutorId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: true,
          })),
        );
      }
    });

    return this.getTutorAvailabilitySlots(tutorId);
  }

  async createTutorProfile(userId: string, input: {
    displayName: string; headline?: string; biography?: string; educationSummary?: string;
    hourlyRateCents: number; subjectIds: string[]; availability: string[]; levels?: string[]; timezone: string;
  }) {
    await this.requireVerifiedUser(userId);
    const validWindows = new Set(Object.keys(studyWindows));
    let validTimezone = true;
    try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); } catch { validTimezone = false; }
    if (input.displayName.length > 80 || (input.headline?.length ?? 0) > 140 || (input.biography?.length ?? 0) > 3000 ||
      (input.educationSummary?.length ?? 0) > 1000 || (input.levels?.length ?? 0) > 12 ||
      !Number.isInteger(input.hourlyRateCents) || input.hourlyRateCents < 500 || input.hourlyRateCents > 25000 ||
      input.subjectIds.length < 1 || input.subjectIds.length > 12 || input.availability.length < 1 || input.availability.length > 3 ||
      input.availability.some((window) => !validWindows.has(window)) || new Set(input.availability).size !== input.availability.length ||
      !validTimezone || input.timezone.length > 100) {
      throw new BadRequestException('Check your profile, subjects, and session rate.');
    }
    const selectedSubjects = await db.select({ id: subjects.id }).from(subjects).where(and(
      inArray(subjects.id, input.subjectIds), eq(subjects.active, true),
    ));
    if (selectedSubjects.length !== new Set(input.subjectIds).size) throw new BadRequestException('Choose active Juniper subjects.');
    await db.transaction(async (tx) => {
      await tx.insert(tutorProfiles).values({
        userId, displayName: input.displayName, headline: input.headline ?? null,
        biography: input.biography ?? null, educationSummary: input.educationSummary ?? null,
        hourlyRateCents: input.hourlyRateCents, availability: input.availability, levels: input.levels ?? [], timezone: input.timezone,
        approval: 'pending', reviewedAt: null, reviewedBy: null, reviewNote: null,
      }).onConflictDoUpdate({
        target: tutorProfiles.userId,
        set: {
          displayName: input.displayName, headline: input.headline ?? null,
          biography: input.biography ?? null, educationSummary: input.educationSummary ?? null,
          hourlyRateCents: input.hourlyRateCents, availability: input.availability, levels: input.levels ?? [], timezone: input.timezone,
          approval: 'pending', reviewedAt: null, reviewedBy: null, reviewNote: null, updatedAt: new Date(),
        },
      });
      await tx.delete(tutorSubjects).where(eq(tutorSubjects.tutorId, userId));
      await tx.insert(tutorSubjects).values(input.subjectIds.map((subjectId) => ({ tutorId: userId, subjectId })));
    });
    return { status: 'pending' as const, message: 'Your profile is saved for tutor review.' };
  }

  async createRequest(userId: string, input: {
    subjectId: string; title: string; details: string; level?: string; deadline: string; budgetCents: number;
    timezone?: string; preferredTimes?: string[]; sessionDurationMinutes?: number; targetTutorId?: string;
    serviceType?: string; helpType?: string; customSubject?: string; customCourse?: string; university?: string; instructionLanguage?: string;
  }) {
    await this.requireVerifiedUser(userId);
    const deadline = new Date(input.deadline);
    if (input.title.length < 5 || input.title.length > 120 || input.details.length < 10 || input.details.length > 5000 ||
      (input.customSubject?.length ?? 0) > 120 || (input.customCourse?.length ?? 0) > 160 || (input.university?.length ?? 0) > 160 || (input.instructionLanguage?.length ?? 0) > 80 ||
      !Number.isFinite(deadline.getTime()) || deadline.getTime() < Date.now() + 15 * 60_000 ||
      !Number.isInteger(input.budgetCents) || input.budgetCents < 500 || input.budgetCents > 2_000_000 ||
      (input.sessionDurationMinutes != null && (!Number.isInteger(input.sessionDurationMinutes) || input.sessionDurationMinutes < 15 || input.sessionDurationMinutes > 240)) ||
      (input.preferredTimes != null && (input.preferredTimes.length > 8 || input.preferredTimes.some((time) => time.length > 100)))) {
      throw new BadRequestException('Check the title, details, deadline, and budget.');
    }
    const timezone = input.timezone ?? 'UTC';
    const validHelpTypes = new Set(['tutoring', 'exam_prep', 'homework', 'language', 'project', 'quick_question']);
    if (input.helpType && !validHelpTypes.has(input.helpType)) throw new BadRequestException('Choose one of the available help types.');
    if (input.serviceType && !['assignment_project', 'exam_prep', 'live_session'].includes(input.serviceType)) {
      throw new BadRequestException('Choose a supported session format.');
    }
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { throw new BadRequestException('Choose a valid time zone.'); }
    const [subject] = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(
      eq(subjects.id, input.subjectId), eq(subjects.active, true),
    )).limit(1);
    if (!subject) throw new BadRequestException('Choose an active subject.');
    const [profile] = await db.select({ userId: learnerProfiles.userId, displayName: learnerProfiles.displayName }).from(learnerProfiles)
      .where(eq(learnerProfiles.userId, userId)).limit(1);
    if (!profile) throw new ForbiddenException('Create a learner profile before posting a request.');

    let targetTutorId: string | null = null;
    if (input.targetTutorId) {
      const [tutor] = await db.select({ userId: tutorProfiles.userId, displayName: tutorProfiles.displayName }).from(tutorProfiles)
        .where(and(eq(tutorProfiles.userId, input.targetTutorId), eq(tutorProfiles.approval, 'approved'))).limit(1);
      if (!tutor) throw new BadRequestException('Target tutor not found or not approved.');
      targetTutorId = tutor.userId;
    }

    const [request] = await db.insert(studyRequests).values({
      learnerId: userId, subjectId: input.subjectId, title: input.title,
      customSubject: input.customSubject?.trim() || null, customCourse: input.customCourse?.trim() || null,
      university: input.university?.trim() || null, instructionLanguage: input.instructionLanguage?.trim() || null,
      helpType: input.helpType ?? (input.serviceType === 'exam_prep' ? 'exam_prep' : input.serviceType === 'live_session' ? 'tutoring' : 'homework'),
      details: input.details, level: input.level?.slice(0, 80) ?? null,
      serviceType: input.serviceType ?? 'assignment_project',
      targetGrade: 'not_specified',
      gradeGuarantee: false,
      deadline, budgetCents: input.budgetCents, currency: 'USD', timezone,
      preferredTimes: input.preferredTimes ?? [], sessionDurationMinutes: input.sessionDurationMinutes ?? 60,
      targetTutorId,
    }).returning();

    if (targetTutorId) {
      await this.notify(
        targetTutorId,
        'direct_request',
        `Direct request from ${profile.displayName}`,
        `${profile.displayName} asked for an offer on ${subject.name}: "${input.title}"`,
        `/requests/${request.id}`,
      );
    }

    return request;
  }

  async listMyRequests(userId: string) {
    await this.requireVerifiedUser(userId);
    return db.select({
      id: studyRequests.id, title: studyRequests.title, details: studyRequests.details,
      deadline: studyRequests.deadline, budgetCents: studyRequests.budgetCents,
      currency: studyRequests.currency, status: studyRequests.status,
      serviceType: studyRequests.serviceType,
      helpType: studyRequests.helpType,
      createdAt: studyRequests.createdAt, subject: subjects.name,
      timezone: studyRequests.timezone, preferredTimes: studyRequests.preferredTimes,
      sessionDurationMinutes: studyRequests.sessionDurationMinutes,
      targetTutorId: studyRequests.targetTutorId,
      targetTutorName: tutorProfiles.displayName,
      offerCount: sql<number>`count(${offers.id})::int`,
      customSubject: studyRequests.customSubject, customCourse: studyRequests.customCourse, university: studyRequests.university,
      instructionLanguage: studyRequests.instructionLanguage,
    }).from(studyRequests).innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .leftJoin(tutorProfiles, eq(tutorProfiles.userId, studyRequests.targetTutorId))
      .leftJoin(offers, eq(offers.requestId, studyRequests.id))
      .where(eq(studyRequests.learnerId, userId))
      .groupBy(studyRequests.id, subjects.name, tutorProfiles.displayName).orderBy(desc(studyRequests.createdAt));
  }

  async getRequest(userId: string, requestId: string) {
    await this.requireVerifiedUser(userId);
    const [request] = await db.select({
      id: studyRequests.id, learnerId: studyRequests.learnerId,
      title: studyRequests.title, details: studyRequests.details,
      deadline: studyRequests.deadline, budgetCents: studyRequests.budgetCents,
      currency: studyRequests.currency, status: studyRequests.status,
      serviceType: studyRequests.serviceType,
      helpType: studyRequests.helpType,
      createdAt: studyRequests.createdAt, subjectId: studyRequests.subjectId,
      targetTutorId: studyRequests.targetTutorId,
      customSubject: studyRequests.customSubject, customCourse: studyRequests.customCourse, university: studyRequests.university,
      instructionLanguage: studyRequests.instructionLanguage,
      targetTutorName: tutorProfiles.displayName,
      timezone: studyRequests.timezone, preferredTimes: studyRequests.preferredTimes,
      sessionDurationMinutes: studyRequests.sessionDurationMinutes,
      subject: subjects.name, learnerDisplayName: learnerProfiles.displayName,
    }).from(studyRequests)
      .innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .innerJoin(learnerProfiles, eq(learnerProfiles.userId, studyRequests.learnerId))
      .leftJoin(tutorProfiles, eq(tutorProfiles.userId, studyRequests.targetTutorId))
      .where(eq(studyRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.learnerId !== userId) {
      await this.canViewRequest(userId, requestId);
      const { learnerId: _learnerId, learnerDisplayName, ...publicRequest } = request;
      const attachments = await this.listRequestAttachments(requestId);
      return { ...publicRequest, learner: learnerDisplayName.split(' ')[0], attachments };
    }
    const { learnerId: _learnerId, learnerDisplayName: _learnerDisplayName, ...ownedRequest } = request;
    return { ...ownedRequest, attachments: await this.listRequestAttachments(requestId) };
  }

  private async listRequestAttachments(requestId: string) {
    return db.select({ id: requestAttachments.id, fileName: requestAttachments.fileName,
      mimeType: requestAttachments.mimeType, sizeBytes: requestAttachments.sizeBytes })
      .from(requestAttachments).where(eq(requestAttachments.requestId, requestId)).orderBy(asc(requestAttachments.createdAt));
  }

  private async canViewRequest(userId: string, requestId: string) {
    const [request] = await db.select({ learnerId: studyRequests.learnerId, subjectId: studyRequests.subjectId,
      subjectName: subjects.name, customSubject: studyRequests.customSubject, customCourse: studyRequests.customCourse, university: studyRequests.university,
      instructionLanguage: studyRequests.instructionLanguage,
      targetTutorId: studyRequests.targetTutorId, status: studyRequests.status }).from(studyRequests)
      .innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .where(eq(studyRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.learnerId === userId) return request;
    const [profile] = await db.select({ approval: tutorProfiles.approval }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile || profile.approval !== 'approved') throw new NotFoundException('Request not found.');
    const [bookingMatch] = await db.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.requestId, requestId), eq(bookings.tutorId, userId), sql`${bookings.status} <> 'cancelled'`)).limit(1);
    let subjectMatch = false;
    if (request.status === 'open' && !request.targetTutorId) {
      const [match] = await db.select({ subjectId: tutorSubjects.subjectId }).from(tutorSubjects)
        .where(and(eq(tutorSubjects.tutorId, userId), eq(tutorSubjects.subjectId, request.subjectId))).limit(1);
      const [customMatch] = request.customSubject ? await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
        .where(and(eq(tutorProfiles.userId, userId), sql`exists (select 1 from unnest(${tutorProfiles.customSubjects}) as custom_subject where lower(custom_subject) = lower(${request.customSubject}))`)).limit(1) : [];
      const [courseMatch] = request.customCourse ? await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
        .where(and(eq(tutorProfiles.userId, userId), or(
          sql`exists (select 1 from unnest(${tutorProfiles.customCourses}) as custom_course where lower(custom_course) like lower(${'%' + request.customCourse + '%'}))`,
          sql`exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${userId}::uuid and (uc.code ilike ${'%' + request.customCourse + '%'} or uc.name ilike ${'%' + request.customCourse + '%'}))`,
        ))).limit(1) : [];
      const [universityMatch] = request.university ? await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
        .where(and(eq(tutorProfiles.userId, userId), or(
          sql`exists (select 1 from unnest(${tutorProfiles.customUniversities}) as custom_university where lower(custom_university) = lower(${request.university}))`,
          sql`exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${userId}::uuid and uc.university ilike ${request.university})`,
        ))).limit(1) : [];
      const [languageMatch] = request.instructionLanguage ? await db.select({ userId: tutorApplications.userId }).from(tutorApplications)
        .where(and(eq(tutorApplications.userId, userId), sql`${tutorApplications.languages} @> ARRAY[${request.instructionLanguage}]::text[]`)).limit(1) : [];
      const subjectEligible = request.customSubject
        ? Boolean(customMatch)
        : Boolean(match || request.subjectName === 'Other subject');
      const courseEligible = !request.customCourse || Boolean(courseMatch);
      const institutionEligible = !request.university || Boolean(universityMatch);
      const languageEligible = !request.instructionLanguage || Boolean(languageMatch);
      subjectMatch = subjectEligible && courseEligible && institutionEligible && languageEligible;
    }
    const directMatch = request.status === 'open' && request.targetTutorId === userId;
    if (!directMatch && !subjectMatch && !bookingMatch) throw new NotFoundException('Request not found.');
    return request;
  }

  async uploadRequestAttachment(userId: string, requestId: string, file?: Express.Multer.File) {
    await this.requireVerifiedUser(userId);
    const request = await this.canViewRequest(userId, requestId);
    if (request.learnerId !== userId || request.status !== 'open') throw new ForbiddenException('Only the learner can add files to an open request.');
    if (!file?.buffer || file.size < 1 || file.size > 10 * 1024 * 1024) throw new BadRequestException('Choose a file smaller than 10 MB.');
    const current = await db.select({ id: requestAttachments.id }).from(requestAttachments)
      .where(eq(requestAttachments.requestId, requestId));
    if (current.length >= 5) throw new BadRequestException('A request can include up to five files.');
    const bytes = file.buffer;
    const mimeType = bytes.subarray(0, 5).toString('ascii') === '%PDF-' ? 'application/pdf'
      : bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png' : null;
    if (!mimeType) throw new BadRequestException('Attach a PDF, JPG, or PNG so Juniper can keep files safe.');
    const storageKey = `requests/${requestId}/${randomUUID()}`;
    await this.storage.save(storageKey, bytes);
    try {
      const fileName = (file.originalname ?? 'learning-file').replace(/[\\/\0-\x1f]/g, '').slice(0, 180) || 'learning-file';
      const [attachment] = await db.insert(requestAttachments).values({
        requestId, storageKey, fileName, mimeType, sizeBytes: file.size,
      }).returning({ id: requestAttachments.id, fileName: requestAttachments.fileName,
        mimeType: requestAttachments.mimeType, sizeBytes: requestAttachments.sizeBytes });
      return attachment;
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async downloadRequestAttachment(userId: string, requestId: string, attachmentId: string) {
    await this.requireVerifiedUser(userId);
    await this.canViewRequest(userId, requestId);
    const [attachment] = await db.select().from(requestAttachments).where(and(
      eq(requestAttachments.id, attachmentId), eq(requestAttachments.requestId, requestId),
    )).limit(1);
    if (!attachment) throw new NotFoundException('Request file not found.');
    return { fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes,
      bytes: await this.storage.read(attachment.storageKey) };
  }

  async getTutorWorkload(userId: string) {
    await this.requireVerifiedUser(userId);
    const [profile] = await db.select({ approval: tutorProfiles.approval }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile || profile.approval !== 'approved') throw new ForbiddenException('An approved tutor profile is required.');
    const rows = await db.select({ scheduledAt: bookings.scheduledAt, durationMinutes: bookings.durationMinutes })
      .from(bookings).where(and(eq(bookings.tutorId, userId), inArray(bookings.status, ['scheduled', 'in_progress'])));
    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
    const upcoming = rows.filter((row) => row.scheduledAt && row.scheduledAt.getTime() >= now && row.scheduledAt.getTime() < weekEnd);
    return {
      activeSessions: rows.length,
      sessionsToArrange: rows.filter((row) => !row.scheduledAt).length,
      hoursNext7Days: Math.round(upcoming.reduce((total, row) => total + row.durationMinutes, 0) / 6) / 10,
    };
  }

  async getOfferGuidance(userId: string, requestId: string) {
    await this.requireVerifiedUser(userId);
    await this.canViewRequest(userId, requestId);
    const [profile] = await db.select({ approval: tutorProfiles.approval }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile || profile.approval !== 'approved') throw new ForbiddenException('An approved tutor profile is required.');
    const [request] = await db.select({ learnerId: studyRequests.learnerId, subjectId: studyRequests.subjectId, customSubject: studyRequests.customSubject,
      serviceType: studyRequests.serviceType, budgetCents: studyRequests.budgetCents, status: studyRequests.status })
      .from(studyRequests).where(eq(studyRequests.id, requestId)).limit(1);
    if (!request || request.learnerId === userId) throw new NotFoundException('Request not found.');
    if (request.status !== 'open') throw new ConflictException('This request is no longer accepting offers.');
    const [subjectMatch] = await db.select({ subjectId: tutorSubjects.subjectId }).from(tutorSubjects)
      .where(and(eq(tutorSubjects.tutorId, userId), eq(tutorSubjects.subjectId, request.subjectId))).limit(1);
    const [customMatch] = request.customSubject ? await db.select({ userId: tutorProfiles.userId }).from(tutorProfiles)
      .where(and(eq(tutorProfiles.userId, userId), sql`exists (select 1 from unnest(${tutorProfiles.customSubjects}) as custom_subject where lower(custom_subject) = lower(${request.customSubject}))`)).limit(1) : [];
    const [otherSubject] = !subjectMatch ? await db.select({ id: subjects.id }).from(subjects)
      .where(and(eq(subjects.id, request.subjectId), eq(subjects.name, 'Other subject'))).limit(1) : [];
    if (!subjectMatch && !customMatch && !otherSubject) throw new ForbiddenException('You can only view guidance for requests in your approved subjects.');
    const [summary] = await db.select({
      sampleCount: sql<number>`count(*)::int`,
      lowCents: sql<number | null>`percentile_cont(0.25) within group (order by ${bookings.amountCents})::int`,
      medianCents: sql<number | null>`percentile_cont(0.5) within group (order by ${bookings.amountCents})::int`,
      highCents: sql<number | null>`percentile_cont(0.75) within group (order by ${bookings.amountCents})::int`,
    }).from(bookings).innerJoin(studyRequests, eq(studyRequests.id, bookings.requestId)).where(and(
      eq(studyRequests.subjectId, request.subjectId), eq(studyRequests.serviceType, request.serviceType),
      inArray(bookings.status, ['scheduled', 'in_progress', 'completed']),
    ));
    return { ...summary, learnerBudgetCents: request.budgetCents };
  }

  async listRequestBoard(userId: string) {
    await this.requireVerifiedUser(userId);
    const [profile] = await db.select({ approval: tutorProfiles.approval, availability: tutorProfiles.availability, timezone: tutorProfiles.timezone, levels: tutorProfiles.levels }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile || profile.approval !== 'approved') throw new ForbiddenException('An approved tutor profile is required.');
    const matchingSubjects = await db.select({ subjectId: tutorSubjects.subjectId }).from(tutorSubjects)
      .where(eq(tutorSubjects.tutorId, userId));
    if (!matchingSubjects.length) return [];
    const rows = await db.select({
      id: studyRequests.id, title: studyRequests.title, details: studyRequests.details,
      deadline: studyRequests.deadline, budgetCents: studyRequests.budgetCents,
      level: studyRequests.level,
      serviceType: studyRequests.serviceType,
      helpType: studyRequests.helpType,
      timezone: studyRequests.timezone, preferredTimes: studyRequests.preferredTimes,
      sessionDurationMinutes: studyRequests.sessionDurationMinutes,
      currency: studyRequests.currency, createdAt: studyRequests.createdAt,
      subjectId: studyRequests.subjectId, subject: subjects.name,
      customSubject: studyRequests.customSubject, customCourse: studyRequests.customCourse, university: studyRequests.university,
      instructionLanguage: studyRequests.instructionLanguage,
      targetTutorId: studyRequests.targetTutorId,
      isDirect: sql<boolean>`case when ${studyRequests.targetTutorId} = ${userId}::uuid then true else false end`,
      learnerDisplayName: learnerProfiles.displayName,
      offerCount: sql<number>`count(${offers.id})::int`,
      hasOffered: sql<boolean>`exists (select 1 from offers own_offer where own_offer.request_id = ${studyRequests.id} and own_offer.tutor_id = ${userId}::uuid)`,
      ownOfferId: sql<string | null>`(select own_offer.id from offers own_offer where own_offer.request_id = ${studyRequests.id} and own_offer.tutor_id = ${userId}::uuid limit 1)`,
      attachments: sql<Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>>`coalesce((
        select jsonb_agg(jsonb_build_object('id', ra.id, 'fileName', ra.file_name, 'mimeType', ra.mime_type, 'sizeBytes', ra.size_bytes) order by ra.created_at)
        from request_attachments ra where ra.request_id = ${studyRequests.id}
      ), '[]'::jsonb)`,
    }).from(studyRequests).innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .innerJoin(learnerProfiles, eq(learnerProfiles.userId, studyRequests.learnerId))
      .innerJoin(tutorProfiles, eq(tutorProfiles.userId, userId))
      .leftJoin(offers, eq(offers.requestId, studyRequests.id))
      .where(and(
        eq(studyRequests.status, 'open'),
        or(eq(studyRequests.targetTutorId, userId),
          and(inArray(studyRequests.subjectId, matchingSubjects.map((row) => row.subjectId)), sql`(${subjects.name} <> 'Other subject' or ${studyRequests.customSubject} is null)`),
          sql`(${studyRequests.customSubject} is not null and exists (select 1 from unnest(${tutorProfiles.customSubjects}) as custom_subject where lower(custom_subject) = lower(${studyRequests.customSubject})))`),
        sql`(${studyRequests.targetTutorId} = ${userId}::uuid or ${studyRequests.customCourse} is null or exists (select 1 from unnest(${tutorProfiles.customCourses}) as custom_course where lower(custom_course) like lower('%' || ${studyRequests.customCourse} || '%')) or exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${userId}::uuid and (uc.code ilike '%' || ${studyRequests.customCourse} || '%' or uc.name ilike '%' || ${studyRequests.customCourse} || '%')))`,
        sql`(${studyRequests.targetTutorId} = ${userId}::uuid or ${studyRequests.university} is null or exists (select 1 from unnest(${tutorProfiles.customUniversities}) as custom_university where lower(custom_university) = lower(${studyRequests.university})) or exists (select 1 from tutor_courses tc inner join university_courses uc on uc.id = tc.course_id where tc.tutor_id = ${userId}::uuid and uc.university ilike ${studyRequests.university}))`,
        sql`(${studyRequests.targetTutorId} = ${userId}::uuid or ${studyRequests.instructionLanguage} is null or exists (select 1 from tutor_applications ta where ta.user_id = ${userId}::uuid and ta.languages @> ARRAY[${studyRequests.instructionLanguage}]::text[]))`,
        sql`(${studyRequests.level} IS NULL OR ${tutorProfiles.levels} @> ARRAY['all']::text[] OR ${tutorProfiles.levels} @> ARRAY[${studyRequests.level}]::text[])`,
        sql`(${studyRequests.targetTutorId} IS NULL OR ${studyRequests.targetTutorId} = ${userId}::uuid)`,
      ))
      .groupBy(studyRequests.id, subjects.name, learnerProfiles.displayName)
      .orderBy(sql`case when ${studyRequests.targetTutorId} = ${userId}::uuid then 0 else 1 end`, asc(studyRequests.deadline)).limit(100);
    return rows.filter((item) => item.isDirect || matchesStudyTime(profile.availability, profile.timezone, item.preferredTimes, item.timezone));
  }

  async listOffers(userId: string, requestId: string) {
    await this.requireVerifiedUser(userId);
    const [request] = await db.select({ learnerId: studyRequests.learnerId }).from(studyRequests)
      .where(eq(studyRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.learnerId !== userId) throw new ForbiddenException('Only the learner who posted this request can view offers.');
    return db.select({
      id: offers.id, amountCents: offers.amountCents, currency: offers.currency,
      note: offers.note, estimatedMinutes: offers.estimatedMinutes, proposedAt: offers.proposedAt, createdAt: offers.createdAt,
      turnaroundHours: offers.turnaroundHours, includesWalkthrough: offers.includesWalkthrough,
      offerType: offers.offerType, packageSessionCount: offers.packageSessionCount, packageDescription: offers.packageDescription,
      tutorId: tutorProfiles.userId, tutorName: tutorProfiles.displayName,
      headline: tutorProfiles.headline, yearsExperience: tutorProfiles.yearsExperience,
    }).from(offers).innerJoin(tutorProfiles, eq(tutorProfiles.userId, offers.tutorId))
      .where(eq(offers.requestId, requestId)).orderBy(asc(offers.amountCents));
  }

  async listOfferMessages(userId: string, requestId: string, offerId: string) {
    await this.requireVerifiedUser(userId);
    const [thread] = await db.select({ learnerId: studyRequests.learnerId, tutorId: offers.tutorId })
      .from(offers).innerJoin(studyRequests, eq(studyRequests.id, offers.requestId))
      .where(and(eq(offers.id, offerId), eq(offers.requestId, requestId))).limit(1);
    if (!thread) throw new NotFoundException('Offer conversation not found.');
    if (userId !== thread.learnerId && userId !== thread.tutorId) throw new NotFoundException('Offer conversation not found.');
    return db.select({ id: offerMessages.id, senderId: offerMessages.senderId, text: offerMessages.text,
      createdAt: offerMessages.createdAt, senderName: users.firstName })
      .from(offerMessages).innerJoin(users, eq(users.id, offerMessages.senderId))
      .where(eq(offerMessages.offerId, offerId)).orderBy(asc(offerMessages.createdAt)).limit(200);
  }

  async sendOfferMessage(userId: string, requestId: string, offerId: string, messageText: string) {
    await this.requireVerifiedUser(userId);
    const [thread] = await db.select({ learnerId: studyRequests.learnerId, tutorId: offers.tutorId,
      requestStatus: studyRequests.status, acceptedOfferId: bookings.offerId })
      .from(offers).innerJoin(studyRequests, eq(studyRequests.id, offers.requestId))
      .leftJoin(bookings, eq(bookings.requestId, studyRequests.id))
      .where(and(eq(offers.id, offerId), eq(offers.requestId, requestId))).limit(1);
    if (!thread) throw new NotFoundException('Offer conversation not found.');
    if (userId !== thread.learnerId && userId !== thread.tutorId) throw new NotFoundException('Offer conversation not found.');
    if (thread.requestStatus === 'cancelled' || thread.requestStatus === 'completed' ||
      (thread.requestStatus !== 'open' && thread.acceptedOfferId !== offerId)) {
      throw new ConflictException('This conversation is closed.');
    }
    const cleanText = messageText.trim();
    if (cleanText.length < 1 || cleanText.length > 2000) throw new BadRequestException('Messages must be 1 to 2,000 characters.');
    const [saved] = await db.insert(offerMessages).values({ offerId, senderId: userId, text: cleanText })
      .returning({ id: offerMessages.id, senderId: offerMessages.senderId, text: offerMessages.text, createdAt: offerMessages.createdAt });
    return saved;
  }

  async createOffer(userId: string, requestId: string, input: {
    amountCents: number; note: string; estimatedMinutes?: number; proposedAt?: string;
    turnaroundHours?: number; includesWalkthrough?: boolean;
    offerType?: string; packageSessionCount?: number; packageDescription?: string;
  }) {
    await this.requireVerifiedUser(userId);
    await this.canViewRequest(userId, requestId);
    const [profile] = await db.select({ approval: tutorProfiles.approval }).from(tutorProfiles)
      .where(eq(tutorProfiles.userId, userId)).limit(1);
    if (!profile || profile.approval !== 'approved') throw new ForbiddenException('An approved tutor profile is required to make offers.');
    if (!Number.isInteger(input.amountCents) || input.amountCents < 500 || input.amountCents > 2_000_000 ||
      input.note.length < 10 || input.note.length > 2000 ||
      (input.estimatedMinutes != null && (!Number.isInteger(input.estimatedMinutes) || input.estimatedMinutes < 15 || input.estimatedMinutes > 480)) ||
      (input.proposedAt != null && (!Number.isFinite(new Date(input.proposedAt).getTime()) || new Date(input.proposedAt).getTime() < Date.now() + 15 * 60_000))) {
      throw new BadRequestException('Check the offer price, note, and time estimate.');
    }
    const [request] = await db.select({ status: studyRequests.status, learnerId: studyRequests.learnerId,
      subjectId: studyRequests.subjectId, sessionDurationMinutes: studyRequests.sessionDurationMinutes })
      .from(studyRequests).where(eq(studyRequests.id, requestId)).limit(1);
    if (!request) throw new NotFoundException('Request not found.');
    if (request.learnerId === userId) throw new ForbiddenException('You cannot offer on your own request.');
    if (request.status !== 'open') throw new BadRequestException('This request is no longer accepting offers.');
    if (input.proposedAt) {
      const proposedStart = new Date(input.proposedAt).getTime();
      const proposedEnd = proposedStart + (request.sessionDurationMinutes ?? 60) * 60_000;
      const commitments = await db.select({ scheduledAt: bookings.scheduledAt, durationMinutes: bookings.durationMinutes })
        .from(bookings).where(and(eq(bookings.tutorId, userId), inArray(bookings.status, ['scheduled', 'in_progress']),
          sql`${bookings.scheduledAt} < ${new Date(proposedEnd)} and ${bookings.scheduledAt} > ${new Date(proposedStart - 8 * 60 * 60_000)}`));
      const overlaps = commitments.some((booking) => {
        if (!booking.scheduledAt) return false;
        const existingStart = booking.scheduledAt.getTime();
        const existingEnd = existingStart + booking.durationMinutes * 60_000;
        return proposedStart < existingEnd && existingStart < proposedEnd;
      });
      if (overlaps) throw new ConflictException('That time overlaps a confirmed session. Choose another time or leave it open to arrange in chat.');
    }
    const [offer] = await db.insert(offers).values({
      requestId, tutorId: userId, amountCents: input.amountCents, note: input.note,
      turnaroundHours: input.turnaroundHours ?? null,
      includesWalkthrough: input.includesWalkthrough !== false,
      gradeCommitment: null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      proposedAt: input.proposedAt ? new Date(input.proposedAt) : null, currency: 'USD',
      offerType: input.offerType ?? 'hourly',
      packageSessionCount: input.packageSessionCount ?? null,
      packageDescription: input.packageDescription ?? null,
    }).onConflictDoUpdate({
      target: [offers.requestId, offers.tutorId],
      set: {
        amountCents: input.amountCents, note: input.note,
        turnaroundHours: input.turnaroundHours ?? null,
        includesWalkthrough: input.includesWalkthrough !== false,
        gradeCommitment: null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        proposedAt: input.proposedAt ? new Date(input.proposedAt) : null, updatedAt: new Date(),
        offerType: input.offerType ?? 'hourly',
        packageSessionCount: input.packageSessionCount ?? null,
        packageDescription: input.packageDescription ?? null,
      },
    }).returning();
    const [requestOwner] = await db.select({ learnerId: studyRequests.learnerId, title: studyRequests.title })
      .from(studyRequests).where(eq(studyRequests.id, requestId)).limit(1);
    if (requestOwner) await this.notify(requestOwner.learnerId, 'new_offer', 'A tutor sent you an offer',
      `A tutor responded to “${requestOwner.title}”. Compare the details when you’re ready.`, `/requests/${requestId}`);
    return offer;
  }

  async acceptOffer(userId: string, offerId: string) {
    await this.requireVerifiedUser(userId);
    const accepted = await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(offers).where(eq(offers.id, offerId)).limit(1);
      if (!offer) throw new NotFoundException('Offer not found.');
      const [request] = await tx.select().from(studyRequests).where(eq(studyRequests.id, offer.requestId)).limit(1);
      if (!request) throw new NotFoundException('Request not found.');
      if (request.learnerId !== userId) throw new ForbiddenException('Only the learner who posted this request can accept an offer.');
      if (request.status !== 'open') throw new BadRequestException('This request has already been matched.');
      const [updated] = await tx.update(studyRequests).set({ status: 'matched', updatedAt: new Date() })
        .where(and(eq(studyRequests.id, request.id), eq(studyRequests.status, 'open')))
        .returning({ id: studyRequests.id });
      if (!updated) throw new BadRequestException('This request has already been matched.');
      const [booking] = await tx.insert(bookings).values({
        requestId: request.id, offerId: offer.id, learnerId: userId, tutorId: offer.tutorId,
        amountCents: offer.amountCents, currency: offer.currency,
        scheduledAt: offer.proposedAt, durationMinutes: offer.estimatedMinutes ?? request.sessionDurationMinutes,
        serviceType: request.serviceType ?? 'assignment_project',
        targetGrade: 'not_specified',
        gradeGuarantee: false,
      }).returning();
      const [conversation] = await tx.insert(conversations).values({ bookingId: booking!.id }).returning();
      const [notification] = await tx.insert(userNotifications).values({
        userId: offer.tutorId, kind: 'booking_confirmed', title: 'A learner accepted your offer',
        body: request.serviceType === 'assignment_project'
          ? 'Your shared learning workroom is ready. Agree on the goal and next steps together.'
          : `Your session time is ${offer.proposedAt ? offer.proposedAt.toISOString() : 'not scheduled yet'}.`,
        targetPath: `/sessions/${booking!.id}`,
      }).returning();
      const {
        escrowStatus: _deferredSettlementField,
        paymentMethodAgreed: _paymentMethod,
        paymentStatus: _paymentStatus,
        paymentReceiptStorageKey: _receiptKey,
        paymentReceiptFileName: _receiptName,
        paymentReceiptMimeType: _receiptMimeType,
        paymentReceiptSizeBytes: _receiptSize,
        paymentReportedAt: _paymentReportedAt,
        paymentConfirmedAt: _paymentConfirmedAt,
        ...publicBooking
      } = booking!;
      return { booking: { ...publicBooking, conversationId: conversation!.id }, notification, tutorId: offer.tutorId };
    });
    if (accepted.notification) this.dispatchNotification(accepted.tutorId, accepted.notification);
    return accepted.booking;
  }

  async listBookings(userId: string) {
    await this.requireVerifiedUser(userId);
    return db.select({
      id: bookings.id, requestId: bookings.requestId, status: bookings.status,
      amountCents: bookings.amountCents, currency: bookings.currency,
      scheduledAt: bookings.scheduledAt, durationMinutes: bookings.durationMinutes,
      serviceType: bookings.serviceType,
      solutionSummary: bookings.solutionSummary,
      explanationWalkthrough: bookings.explanationWalkthrough,
      deliverables: bookings.deliverables,
      revisionNotes: bookings.revisionNotes,
      revisionRequestedAt: bookings.revisionRequestedAt,
      learningRecap: bookings.learningRecap, nextSteps: bookings.nextSteps,
      completedAt: bookings.completedAt, createdAt: bookings.createdAt,
      title: studyRequests.title, details: studyRequests.details,
      deadline: studyRequests.deadline,
      subject: subjects.name,
      tutorName: tutorProfiles.displayName, learnerName: learnerProfiles.displayName,
      tutorId: bookings.tutorId,
      conversationId: conversations.id,
      hasReviewed: sql<boolean>`exists (select 1 from reviews r where r.booking_id = ${bookings.id} and r.reviewer_id = ${userId}::uuid)`,
    }).from(bookings).innerJoin(studyRequests, eq(studyRequests.id, bookings.requestId))
      .innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .innerJoin(tutorProfiles, eq(tutorProfiles.userId, bookings.tutorId))
      .innerJoin(learnerProfiles, eq(learnerProfiles.userId, bookings.learnerId))
      .innerJoin(conversations, eq(conversations.bookingId, bookings.id))
      .where(sql`${bookings.learnerId} = ${userId}::uuid OR ${bookings.tutorId} = ${userId}::uuid`)
      .orderBy(desc(bookings.createdAt));
  }

  private async requireBookingParticipant(userId: string, bookingId: string) {
    const [booking] = await db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.id, bookingId), sql`(${bookings.learnerId} = ${userId}::uuid OR ${bookings.tutorId} = ${userId}::uuid)`,
    )).limit(1);
    if (!booking) throw new NotFoundException('Session not found.');
    const [conversation] = await db.select({ id: conversations.id }).from(conversations)
      .where(eq(conversations.bookingId, bookingId)).limit(1);
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation.id;
  }

  async getMessages(userId: string, bookingId: string) {
    const conversationId = await this.requireBookingParticipant(userId, bookingId);
    await this.markMessagesRead(userId, bookingId, conversationId);
    return db.select({
      id: messages.id, senderId: messages.senderId, text: messages.text,
      createdAt: messages.createdAt, readAt: messages.readAt,
      messageType: messages.messageType,
      audioUrl: messages.audioUrl,
      audioDurationSeconds: messages.audioDurationSeconds,
      attachments: sql<Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>>`coalesce((
        select jsonb_agg(jsonb_build_object('id', ma.id, 'fileName', ma.file_name, 'mimeType', ma.mime_type, 'sizeBytes', ma.size_bytes) order by ma.created_at)
        from message_attachments ma where ma.message_id = ${messages.id}
      ), '[]'::jsonb)`,
    }).from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt)).limit(500);
  }

  async acknowledgeMessages(userId: string, bookingId: string) {
    await this.requireVerifiedUser(userId);
    const conversationId = await this.requireBookingParticipant(userId, bookingId);
    await this.markMessagesRead(userId, bookingId, conversationId);
    return { read: true };
  }

  private async markMessagesRead(userId: string, bookingId: string, conversationId: string) {
    const now = new Date();
    const read = await db.update(messages).set({ readAt: now }).where(and(
      eq(messages.conversationId, conversationId), sql`${messages.senderId} <> ${userId}::uuid`, isNull(messages.readAt),
    )).returning({ id: messages.id, senderId: messages.senderId });
    for (const senderId of new Set(read.map((message) => message.senderId))) {
      this.realtime.emitUser(senderId, 'message:read', {
        bookingId, messageIds: read.filter((message) => message.senderId === senderId).map((message) => message.id), readAt: now.toISOString(),
      });
    }
  }

  async uploadMessageAttachment(userId: string, bookingId: string, file?: Express.Multer.File) {
    await this.requireVerifiedUser(userId);
    await this.requireBookingParticipant(userId, bookingId);
    if (!file?.buffer || file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Choose an attachment smaller than 10 MB.');
    }
    const bytes = file.buffer;
    const mimeType = bytes.subarray(0, 5).toString('ascii') === '%PDF-'
      ? 'application/pdf'
      : bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? 'image/jpeg'
        : bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          ? 'image/png'
          : null;
    if (!mimeType) throw new BadRequestException('Attach a PDF, JPG, or PNG so Juniper can keep files safe.');
    const storageKey = `messages/${bookingId}/${randomUUID()}`;
    await this.storage.save(storageKey, bytes);
    try {
      const cleanName = (file.originalname ?? 'learning-file').replace(/[\\/\0-\x1f]/g, '').slice(0, 180) || 'learning-file';
      const [attachment] = await db.insert(messageAttachments).values({
        bookingId, uploaderId: userId, storageKey, fileName: cleanName, mimeType, sizeBytes: file.size,
      }).returning({ id: messageAttachments.id, fileName: messageAttachments.fileName,
        mimeType: messageAttachments.mimeType, sizeBytes: messageAttachments.sizeBytes });
      return attachment;
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async downloadMessageAttachment(userId: string, bookingId: string, attachmentId: string) {
    await this.requireVerifiedUser(userId);
    await this.requireBookingParticipant(userId, bookingId);
    const [attachment] = await db.select().from(messageAttachments).where(and(
      eq(messageAttachments.id, attachmentId), eq(messageAttachments.bookingId, bookingId), sql`${messageAttachments.messageId} IS NOT NULL`,
    )).limit(1);
    if (!attachment) throw new NotFoundException('Shared attachment not found.');
    return { fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes,
      bytes: await this.storage.read(attachment.storageKey) };
  }

  async sendMessage(
    userId: string,
    bookingId: string,
    text: string,
    attachmentIds: string[] = [],
    extra?: { messageType?: string; audioUrl?: string; audioDurationSeconds?: number },
  ) {
    await this.requireVerifiedUser(userId);
    const cleanText = text.trim();
    const isVoice = extra?.messageType === 'voice' && Boolean(extra?.audioUrl);
    if ((!cleanText && !attachmentIds.length && !isVoice) || cleanText.length > 5000 || attachmentIds.length > 5 || new Set(attachmentIds).size !== attachmentIds.length) {
      throw new BadRequestException('Add a message, voice note, or up to five attachments.');
    }
    const conversationId = await this.requireBookingParticipant(userId, bookingId);
    const message = await db.transaction(async (tx) => {
      const [created] = await tx.insert(messages).values({
        conversationId,
        senderId: userId,
        text: cleanText || (isVoice ? 'Voice note' : 'Shared an attachment.'),
        messageType: extra?.messageType ?? 'text',
        audioUrl: extra?.audioUrl ?? null,
        audioDurationSeconds: extra?.audioDurationSeconds ?? null,
      }).returning({
        id: messages.id,
        senderId: messages.senderId,
        text: messages.text,
        createdAt: messages.createdAt,
        readAt: messages.readAt,
        messageType: messages.messageType,
        audioUrl: messages.audioUrl,
        audioDurationSeconds: messages.audioDurationSeconds,
      });
      if (attachmentIds.length) {
        const attached = await tx.update(messageAttachments).set({ messageId: created!.id }).where(and(
          inArray(messageAttachments.id, attachmentIds), eq(messageAttachments.bookingId, bookingId),
          eq(messageAttachments.uploaderId, userId), isNull(messageAttachments.messageId),
        )).returning({ id: messageAttachments.id });
        if (attached.length !== attachmentIds.length) throw new BadRequestException('One of these attachments is no longer available. Please choose it again.');
      }
      const linked = await tx.select({ id: messageAttachments.id, fileName: messageAttachments.fileName,
        mimeType: messageAttachments.mimeType, sizeBytes: messageAttachments.sizeBytes })
        .from(messageAttachments).where(eq(messageAttachments.messageId, created!.id));
      return { ...created!, attachments: linked };
    });
    const [booking] = await db.select({ learnerId: bookings.learnerId, tutorId: bookings.tutorId, title: studyRequests.title })
      .from(bookings).innerJoin(studyRequests, eq(studyRequests.id, bookings.requestId))
      .where(eq(bookings.id, bookingId)).limit(1);
    const otherUserId = booking?.learnerId === userId ? booking.tutorId : booking?.learnerId;
    if (otherUserId) {
      this.realtime.emitUser(otherUserId, 'message:new', { bookingId, message });
      this.realtime.emitUser(userId, 'message:new', { bookingId, message });
      await this.notify(otherUserId, 'new_message', 'A new Juniper message',
        `You have a new message about “${booking?.title ?? 'your session'}”.`, `/chat/${bookingId}`);
    }
    return message;
  }

  async completeBooking(userId: string, bookingId: string, input: { learningRecap: string; nextSteps: string }) {
    await this.requireVerifiedUser(userId);
    if (input.learningRecap.trim().length < 20 || input.learningRecap.length > 5000 ||
      input.nextSteps.trim().length < 10 || input.nextSteps.length > 3000) {
      throw new BadRequestException('Add a useful session recap and one clear next step.');
    }
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.tutorId, userId))).limit(1);
    if (!booking) throw new NotFoundException('Session not found.');
    if (booking.status !== 'scheduled' && booking.status !== 'in_progress') throw new ConflictException('This session cannot be completed in its current state.');
    const [updated] = await db.update(bookings).set({
      status: 'completed', learningRecap: input.learningRecap.trim(), nextSteps: input.nextSteps.trim(),
      completedAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(bookings.id, bookingId), eq(bookings.tutorId, userId), inArray(bookings.status, ['scheduled', 'in_progress'])))
      .returning({ learnerId: bookings.learnerId, id: bookings.id });
    if (!updated) throw new ConflictException('This session has already changed. Refresh and try again.');
    await this.notify(updated.learnerId, 'session_completed', 'Your learning recap is ready',
      'Your tutor shared what you covered and what to try next.', `/sessions/${bookingId}`);
    return { status: 'completed', completedAt: new Date().toISOString() };
  }

  async cancelBooking(userId: string, bookingId: string) {
    await this.requireVerifiedUser(userId);
    const [booking] = await db.select().from(bookings).where(and(
      eq(bookings.id, bookingId), sql`(${bookings.learnerId} = ${userId}::uuid OR ${bookings.tutorId} = ${userId}::uuid)`,
    )).limit(1);
    if (!booking) throw new NotFoundException('Session not found.');
    if (booking.status === 'completed' || booking.status === 'cancelled') throw new ConflictException('This session can no longer be cancelled.');
    const [updated] = await db.update(bookings).set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ['scheduled', 'in_progress'])))
      .returning({ learnerId: bookings.learnerId, tutorId: bookings.tutorId });
    if (!updated) throw new ConflictException('This session has already changed. Refresh and try again.');
    const otherUserId = updated.learnerId === userId ? updated.tutorId : updated.learnerId;
    await this.notify(otherUserId, 'session_cancelled', 'A session was cancelled', 'Open your session to review the latest details.', '/(tabs)/activity');
    return { status: 'cancelled' };
  }

  async createReview(userId: string, bookingId: string, rating: number, comment: string) {
    await this.requireVerifiedUser(userId);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) throw new BadRequestException('Choose a rating from 1 to 5 and keep your note under 2,000 characters.');
    const [booking] = await db.select({ tutorId: bookings.tutorId, status: bookings.status })
      .from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.learnerId, userId))).limit(1);
    if (!booking) throw new NotFoundException('Session not found.');
    if (booking.status !== 'completed') throw new ConflictException('You can review the tutor after the session is complete.');
    try {
      const [review] = await db.insert(reviews).values({
        bookingId, reviewerId: userId, tutorId: booking.tutorId, rating, comment: comment.trim() || null,
      }).returning();
      return review;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('You already reviewed this session.');
      throw error;
    }
  }

  async listTutorTags(tutorId: string) {
    return db.select().from(tutorTags).where(eq(tutorTags.tutorId, tutorId)).orderBy(desc(tutorTags.endorsementCount), asc(tutorTags.tagString));
  }

  async endorseTutorTag(userId: string, tutorId: string, tagString: string) {
    await this.requireVerifiedUser(userId);
    const tag = tagString.trim().slice(0, 60);
    if (tag.length < 2) throw new BadRequestException('Tag is too short.');
    const [existing] = await db.select().from(tutorTags).where(and(eq(tutorTags.tutorId, tutorId), eq(tutorTags.tagString, tag))).limit(1);
    if (existing) {
      const [updated] = await db.update(tutorTags).set({ endorsementCount: sql`${tutorTags.endorsementCount} + 1` }).where(eq(tutorTags.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(tutorTags).values({ tutorId, tagString: tag, endorsementCount: 1 }).returning();
    return created;
  }

  async getBooking(userId: string, bookingId: string) {
    await this.requireVerifiedUser(userId);
    const [booking] = await db.select({
      id: bookings.id, requestId: bookings.requestId, status: bookings.status,
      amountCents: bookings.amountCents, currency: bookings.currency,
      scheduledAt: bookings.scheduledAt, durationMinutes: bookings.durationMinutes,
      serviceType: bookings.serviceType,
      solutionSummary: bookings.solutionSummary,
      explanationWalkthrough: bookings.explanationWalkthrough,
      deliverables: bookings.deliverables,
      revisionNotes: bookings.revisionNotes,
      revisionRequestedAt: bookings.revisionRequestedAt,
      releasedAt: bookings.releasedAt,
      learningRecap: bookings.learningRecap, nextSteps: bookings.nextSteps,
      completedAt: bookings.completedAt, createdAt: bookings.createdAt,
      tutorId: bookings.tutorId, learnerId: bookings.learnerId,
      title: studyRequests.title, details: studyRequests.details,
      deadline: studyRequests.deadline,
      subject: subjects.name,
      tutorName: tutorProfiles.displayName, learnerName: learnerProfiles.displayName,
      conversationId: conversations.id,
      hasReviewed: sql<boolean>`exists (select 1 from reviews r where r.booking_id = ${bookings.id} and r.reviewer_id = ${userId}::uuid)`,
    }).from(bookings).innerJoin(studyRequests, eq(studyRequests.id, bookings.requestId))
      .innerJoin(subjects, eq(subjects.id, studyRequests.subjectId))
      .innerJoin(tutorProfiles, eq(tutorProfiles.userId, bookings.tutorId))
      .innerJoin(learnerProfiles, eq(learnerProfiles.userId, bookings.learnerId))
      .innerJoin(conversations, eq(conversations.bookingId, bookings.id))
      .where(and(eq(bookings.id, bookingId), sql`(${bookings.learnerId} = ${userId}::uuid OR ${bookings.tutorId} = ${userId}::uuid)`))
      .limit(1);
    if (!booking) throw new NotFoundException('Session or assignment workroom not found.');
    return booking;
  }

  async setTutorSubscriptionPaid(adminId: string, tutorId: string, paid: boolean) {
    await this.requireAdministrator(adminId);
    const [profile] = await db.update(tutorProfiles).set({
      subscriptionPaid: paid,
      approval: paid ? 'approved' : 'suspended_pending_subscription',
      updatedAt: new Date(),
    }).where(eq(tutorProfiles.userId, tutorId)).returning({
      userId: tutorProfiles.userId, subscriptionPaid: tutorProfiles.subscriptionPaid, approval: tutorProfiles.approval,
    });
    if (!profile) throw new NotFoundException('Tutor profile not found.');
    return profile;
  }

  async deliverSolution(userId: string, bookingId: string, input: {
    solutionSummary: string;
    explanationWalkthrough: string;
    deliverables?: Array<{ title: string; url?: string; description?: string }>;
  }) {
    await this.requireVerifiedUser(userId);
    if (input.solutionSummary.trim().length < 5 || input.solutionSummary.length > 5000 ||
        input.explanationWalkthrough.trim().length < 20 || input.explanationWalkthrough.length > 15000) {
      throw new BadRequestException('Please provide an informative summary and a step-by-step explanation walkthrough.');
    }
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.tutorId, userId))).limit(1);
    if (!booking) throw new NotFoundException('Workroom not found or you are not the assigned tutor.');
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new ConflictException('This workroom is closed.');
    }
    const [updated] = await db.update(bookings).set({
      solutionSummary: input.solutionSummary.trim(),
      explanationWalkthrough: input.explanationWalkthrough.trim(),
      deliverables: input.deliverables ?? [],
      status: 'in_progress',
      updatedAt: new Date(),
    }).where(and(eq(bookings.id, bookingId), eq(bookings.tutorId, userId)))
      .returning();
    if (!updated) throw new ConflictException('Workroom update conflict.');
    await this.notify(updated.learnerId, 'solution_delivered', 'Your learning walkthrough is ready',
      'Your tutor added a step-by-step explanation to the shared workroom.',
      `/sessions/${bookingId}`);
    return updated;
  }

  async requestRevision(userId: string, bookingId: string, input: { revisionNotes: string }) {
    await this.requireVerifiedUser(userId);
    if (input.revisionNotes.trim().length < 5 || input.revisionNotes.length > 3000) {
      throw new BadRequestException('Please specify the steps or concepts you would like clarified.');
    }
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.learnerId, userId))).limit(1);
    if (!booking) throw new NotFoundException('Workroom not found or you are not the student.');
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new ConflictException('This workroom is closed.');
    }
    const [updated] = await db.update(bookings).set({
      revisionNotes: input.revisionNotes.trim(),
      revisionRequestedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(bookings.id, bookingId), eq(bookings.learnerId, userId)))
      .returning();
    if (!updated) throw new ConflictException('Workroom update conflict.');
    await this.notify(updated.tutorId, 'revision_requested', 'Learner requested walkthrough clarification',
      `The student asked for clarification: "${input.revisionNotes.trim().slice(0, 100)}..."`,
      `/sessions/${bookingId}`);
    return updated;
  }

  async assistRequest(input: { prompt: string; subjectName?: string }) {
    const raw = input.prompt.trim();
    if (!raw || raw.length < 5) throw new BadRequestException('Please provide a prompt or assignment description.');
    const lower = raw.toLowerCase();
    let serviceType = 'assignment_project';
    if (lower.includes('exam') || lower.includes('quiz') || lower.includes('midterm') || lower.includes('final') || lower.includes('test')) {
      serviceType = 'exam_prep';
    } else if (lower.includes('call') || lower.includes('session') || lower.includes('talk') || lower.includes('live')) {
      serviceType = 'live_session';
    }
    const firstSentence = raw.split(/[.\n!?]/)[0]?.trim().slice(0, 75) || 'Assignment & Study Request';
    const cleanTitle = firstSentence.length > 10 ? firstSentence : `${input.subjectName ?? 'Subject'} Assignment Help & Walkthrough`;
    const cleanDetails = raw.length > 40
      ? `${raw}\n\nLearning goals:\n• Work through the underlying ideas together.\n• Use examples and guided practice to build independent understanding.\n• Leave with clear notes and next steps.`
      : `${raw} — I would like guided practice and clear explanations so I can understand the concepts and work through similar questions independently.`;
    return {
      title: cleanTitle,
      details: cleanDetails,
      serviceType,
      estimatedBudget: 35,
      estimatedMinutes: 60,
    };
  }
}
