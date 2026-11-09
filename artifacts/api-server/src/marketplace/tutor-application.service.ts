import { randomUUID } from 'node:crypto';
import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import {
  and, asc, db, emailOutbox, eq, inArray, isNull, subjects, tutorApplications, tutorApplicationDocuments,
  tutorApplicationReviewEvents, tutorProfiles, tutorSubjects, userNotifications, users,
} from '@workspace/db';
import { TutorDocumentStorage } from './tutor-document-storage.js';
import { MarketplaceService } from './marketplace.service.js';

const categories = ['transcript', 'degree_certificate', 'enrollment_proof', 'teaching_certificate', 'cv', 'portfolio_evidence', 'other'] as const;
const validMimes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type Decision = 'approved' | 'needs_info' | 'rejected' | 'suspended';

function looksLikeRepeatedFiller(value: string | null | undefined) { return Boolean(value && /(.)\1{5,}/iu.test(value)); }

@Injectable()
export class TutorApplicationService {
  constructor(
    @Inject(TutorDocumentStorage) private readonly storage: TutorDocumentStorage,
    @Inject(MarketplaceService) private readonly marketplace: MarketplaceService,
  ) {}

  private admin(userId: string) {
    const allowed = new Set((process.env.JUNIPER_ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean));
    if (!allowed.has(userId)) throw new ForbiddenException('Administrator access is required.');
  }

  async getMine(userId: string) {
    await this.requireVerifiedTutor(userId);
    const [application] = await db.select().from(tutorApplications).where(eq(tutorApplications.userId, userId)).limit(1);
    if (!application) throw new NotFoundException('Tutor application not found.');
    const [profile] = await db.select().from(tutorProfiles).where(eq(tutorProfiles.userId, userId)).limit(1);
    const docs = await db.select({ id: tutorApplicationDocuments.id, category: tutorApplicationDocuments.category,
      fileName: tutorApplicationDocuments.fileName, mimeType: tutorApplicationDocuments.mimeType,
      sizeBytes: tutorApplicationDocuments.sizeBytes, reviewStatus: tutorApplicationDocuments.reviewStatus,
      reviewerNote: tutorApplicationDocuments.reviewerNote, createdAt: tutorApplicationDocuments.createdAt,
    }).from(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.userId, userId)).orderBy(asc(tutorApplicationDocuments.createdAt));
    const selectedSubjects = await db.select({ id: subjects.id, name: subjects.name }).from(tutorSubjects)
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId)).where(eq(tutorSubjects.tutorId, userId)).orderBy(asc(subjects.name));
    return { ...application, documents: docs, profile: profile ? { ...profile, subjects: selectedSubjects } : null };
  }

  async saveDraft(userId: string, input: Record<string, unknown>) {
    await this.requireVerifiedTutor(userId);
    const application = await this.application(userId);
    if (['approved', 'rejected', 'suspended'].includes(application.status)) throw new ConflictException('This application cannot be edited in its current state.');
    const legalName = this.draftText(input.legalName, 120);
    const applicantType = this.draftText(input.applicantType, 24) || 'graduate';
    if (!['student', 'graduate', 'professional'].includes(applicantType)) throw new BadRequestException('Choose your tutor pathway.');
    const displayName = this.draftText(input.displayName, 80);
    const institution = this.draftText(input.institution, 160);
    const fieldOfStudy = this.draftText(input.fieldOfStudy, 120);
    const degreeLevel = this.draftText(input.degreeLevel, 80);
    const biography = this.draftText(input.biography, 3000);
    const educationSummary = this.draftText(input.educationSummary, 1000);
    const headline = this.draftText(input.headline, 140);
    const timezone = this.draftText(input.timezone, 100) || 'UTC';
    const country = this.optionalText(input.country, 100);
    const gradeValue = this.optionalText(input.gradeValue, 24);
    const gradeScale = this.optionalText(input.gradeScale, 24);
    const yearNumber = Number(input.graduationYear);
    const year = Number.isInteger(yearNumber) && yearNumber > 0 ? yearNumber : null;
    const yearsNumber = Number(input.yearsExperience);
    const yearsExperience = Number.isInteger(yearsNumber) && yearsNumber >= 0 ? yearsNumber : 0;
    const rateNumber = Number(input.hourlyRateCents);
    const rate = Number.isInteger(rateNumber) && rateNumber > 0 ? rateNumber : 2800;
    const languages = this.stringArray(input.languages, 'languages', 10);
    const levels = this.stringArray(input.levels, 'learner levels', 12);
    const availability = this.stringArray(input.availability, 'availability', 3);
    const subjectIds = this.stringArray(input.subjectIds, 'subjects', 12);
    const customSubjects = this.stringArray(input.customSubjects ?? [], 'custom subjects', 30);
    const customCourses = this.stringArray(input.customCourses ?? [], 'custom courses', 30);
    const customUniversities = this.stringArray(input.customUniversities ?? [], 'custom institutions', 30);
    if (year !== null && (year < 1950 || year > new Date().getFullYear() + 8)) throw new BadRequestException('Enter a valid graduation year.');
    if (yearsExperience > 80) throw new BadRequestException('Enter valid teaching experience.');
    if (!Number.isInteger(rate) || rate < 500 || rate > 25000) throw new BadRequestException('Choose a rate between $5 and $250 per hour.');
    const windows = new Set(['Weekday mornings', 'Weekday evenings', 'Weekend']);
    let validTimezone = true;
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { validTimezone = false; }
    if (availability.some((window) => !windows.has(window)) || !validTimezone) throw new BadRequestException('Choose valid study windows and a supported timezone.');
    const activeSubjects = subjectIds.length ? await db.select({ id: subjects.id }).from(subjects).where(and(inArray(subjects.id, subjectIds), eq(subjects.active, true))) : [];
    if (activeSubjects.length !== new Set(subjectIds).size) throw new BadRequestException('Choose active Juniper subjects.');
    const status = application.status === 'needs_info' ? 'needs_info' : 'draft';
    await db.transaction(async (tx) => {
      await tx.update(tutorApplications).set({ legalName, applicantType, country, degreeLevel, institution, fieldOfStudy,
        graduationYear: year, gradeValue, gradeScale, yearsExperience, languages, status, updatedAt: new Date() })
        .where(eq(tutorApplications.userId, userId));
      await tx.insert(tutorProfiles).values({ userId, displayName, headline, biography, educationSummary,
        hourlyRateCents: rate, availability, levels, timezone, customSubjects, customCourses, customUniversities, approval: 'draft' }).onConflictDoUpdate({ target: tutorProfiles.userId,
        set: { displayName, headline, biography, educationSummary, hourlyRateCents: rate, availability, levels,
          timezone, customSubjects, customCourses, customUniversities, approval: 'draft', updatedAt: new Date() } });
      await tx.delete(tutorSubjects).where(eq(tutorSubjects.tutorId, userId));
      if (subjectIds.length) await tx.insert(tutorSubjects).values(subjectIds.map((subjectId) => ({ tutorId: userId, subjectId })));
    });
    return this.getMine(userId);
  }

  async upload(userId: string, category: string, file: Express.Multer.File) {
    await this.requireVerifiedTutor(userId);
    const application = await this.application(userId);
    if (!['draft', 'needs_info'].includes(application.status)) throw new ConflictException('Documents can’t be changed while your application is under review.');
    if (!categories.includes(category as typeof categories[number])) throw new BadRequestException('Choose a document type.');
    if (!file?.buffer || file.size < 1 || file.size > 10 * 1024 * 1024) throw new BadRequestException('Choose a file smaller than 10 MB.');
    const mimeType = this.detectMime(file.buffer);
    if (!mimeType || !validMimes.includes(mimeType)) throw new BadRequestException('Upload a PDF, JPG, or PNG document.');
    const storageKey = `tutor-applications/${userId}/${randomUUID()}`;
    await this.storage.save(storageKey, file.buffer);
    try {
      const [doc] = await db.insert(tutorApplicationDocuments).values({ userId, category: category as typeof categories[number],
        storageKey, fileName: this.safeFileName(file.originalname), mimeType, sizeBytes: file.size }).returning({ id: tutorApplicationDocuments.id });
      return { id: doc!.id, category, fileName: this.safeFileName(file.originalname), mimeType, sizeBytes: file.size, reviewStatus: 'pending' };
    } catch (error) { await this.storage.remove(storageKey).catch(() => undefined); throw error; }
  }

  async deleteDocument(userId: string, id: string) {
    const [doc] = await db.select().from(tutorApplicationDocuments).where(and(eq(tutorApplicationDocuments.id, id), eq(tutorApplicationDocuments.userId, userId))).limit(1);
    if (!doc) throw new NotFoundException('Document not found.');
    const application = await this.application(userId);
    if (!['draft', 'needs_info'].includes(application.status)) throw new ConflictException('Documents can’t be changed while your application is under review.');
    await db.delete(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.id, id));
    await this.storage.remove(doc.storageKey);
    return { deleted: true };
  }

  async submit(userId: string) {
    await this.requireVerifiedTutor(userId);
    const application = await this.application(userId);
    if (!['draft', 'needs_info'].includes(application.status)) throw new ConflictException('Your application is already with the review team.');
    const [profile] = await db.select().from(tutorProfiles).where(eq(tutorProfiles.userId, userId)).limit(1);
    const documents = await db.select({ category: tutorApplicationDocuments.category, reviewStatus: tutorApplicationDocuments.reviewStatus })
      .from(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.userId, userId));
    const hasTranscript = documents.some((doc) => doc.category === 'transcript' && doc.reviewStatus !== 'replace_requested');
    const hasDegree = documents.some((doc) => doc.category === 'degree_certificate' && doc.reviewStatus !== 'replace_requested');
    const hasEnrollment = documents.some((doc) => doc.category === 'enrollment_proof' && doc.reviewStatus !== 'replace_requested');
    if (application.legalName.trim().length < 3) throw new BadRequestException('Full legal name must be at least 3 characters.');
    if (!application.country?.trim()) throw new BadRequestException('Please enter your country or region.');
    if (!application.degreeLevel?.trim() || !application.institution?.trim() || !application.fieldOfStudy?.trim()) {
      throw new BadRequestException('Please fill in your current study or qualification, institution, and field of study.');
    }
    if (application.applicantType !== 'student' && !application.graduationYear) throw new BadRequestException('Add your graduation year.');
    if (!application.languages?.length) throw new BadRequestException('Please specify at least one language.');
    if (!profile?.displayName || profile.displayName.trim().length < 2 || looksLikeRepeatedFiller(profile.displayName)) throw new BadRequestException('Use a name or teaching name that learners can recognize.');
    if (!profile?.headline || profile.headline.trim().length < 8 || looksLikeRepeatedFiller(profile.headline)) throw new BadRequestException('Add a clear profile headline of at least 8 characters.');
    if (!profile?.biography || profile.biography.trim().length < 40 || looksLikeRepeatedFiller(profile.biography)) throw new BadRequestException('Describe how you teach in at least 40 characters.');
    if (!profile?.educationSummary || profile.educationSummary.trim().length < 10 || looksLikeRepeatedFiller(profile.educationSummary)) throw new BadRequestException('Add a useful education and experience summary of at least 10 characters.');
    if (!profile?.availability?.length) throw new BadRequestException('Please select at least one day when you are available.');
    const tutorSubjs = await db.select({ id: tutorSubjects.tutorId }).from(tutorSubjects).where(eq(tutorSubjects.tutorId, userId)).limit(1);
    if (!tutorSubjs.length) throw new BadRequestException('Please select at least one subject you teach.');
    if (!hasTranscript) throw new BadRequestException('Please add an academic transcript before submitting.');
    if (application.applicantType === 'student' && !hasEnrollment) throw new BadRequestException('Please add proof of current enrollment before submitting.');
    if (application.applicantType !== 'student' && !hasDegree) throw new BadRequestException('Please add a degree certificate before submitting.');
    await db.transaction(async (tx) => {
      await tx.update(tutorApplications).set({ status: 'in_review', submittedAt: new Date(), reviewedAt: null,
        reviewedBy: null, applicantMessage: null, updatedAt: new Date() }).where(eq(tutorApplications.userId, userId));
      await tx.update(tutorProfiles).set({ approval: 'pending', updatedAt: new Date() }).where(eq(tutorProfiles.userId, userId));
      await tx.insert(tutorApplicationReviewEvents).values({ userId, event: 'submitted' });
    });
    return this.getMine(userId);
  }

  async listForReview(adminId: string) {
    this.admin(adminId);
    const applications = await db.select({ userId: tutorApplications.userId, legalName: tutorApplications.legalName,
      applicantType: tutorApplications.applicantType,
      country: tutorApplications.country, degreeLevel: tutorApplications.degreeLevel, institution: tutorApplications.institution,
      fieldOfStudy: tutorApplications.fieldOfStudy, graduationYear: tutorApplications.graduationYear,
      gradeValue: tutorApplications.gradeValue, gradeScale: tutorApplications.gradeScale,
      yearsExperience: tutorApplications.yearsExperience, languages: tutorApplications.languages,
      status: tutorApplications.status, submittedAt: tutorApplications.submittedAt,
      applicantMessage: tutorApplications.applicantMessage,
      displayName: tutorProfiles.displayName, headline: tutorProfiles.headline, biography: tutorProfiles.biography,
      educationSummary: tutorProfiles.educationSummary, hourlyRateCents: tutorProfiles.hourlyRateCents,
      customSubjects: tutorProfiles.customSubjects, customCourses: tutorProfiles.customCourses, customUniversities: tutorProfiles.customUniversities,
      availability: tutorProfiles.availability, levels: tutorProfiles.levels,
      email: users.email, firstName: users.firstName, lastName: users.lastName,
    }).from(tutorApplications).innerJoin(users, eq(users.id, tutorApplications.userId))
      .leftJoin(tutorProfiles, eq(tutorProfiles.userId, tutorApplications.userId))
      .where(inArray(tutorApplications.status, ['in_review', 'submitted', 'needs_info']))
      .orderBy(asc(tutorApplications.submittedAt)).limit(100);
    const result = [];
    for (const application of applications) {
      const docs = await db.select({ id: tutorApplicationDocuments.id, category: tutorApplicationDocuments.category,
        fileName: tutorApplicationDocuments.fileName, mimeType: tutorApplicationDocuments.mimeType,
        sizeBytes: tutorApplicationDocuments.sizeBytes, reviewStatus: tutorApplicationDocuments.reviewStatus,
        reviewerNote: tutorApplicationDocuments.reviewerNote, createdAt: tutorApplicationDocuments.createdAt,
      }).from(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.userId, application.userId));
      const selectedSubjects = await db.select({ name: subjects.name }).from(tutorSubjects)
        .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId)).where(eq(tutorSubjects.tutorId, application.userId));
      result.push({ ...application, subjects: selectedSubjects.map((item) => item.name), documents: docs });
    }
    return result;
  }

  async documentForAdmin(adminId: string, userId: string, documentId: string) {
    this.admin(adminId);
    const [doc] = await db.select().from(tutorApplicationDocuments).where(and(
      eq(tutorApplicationDocuments.id, documentId), eq(tutorApplicationDocuments.userId, userId))).limit(1);
    if (!doc) throw new NotFoundException('Document not found.');
    return { ...doc, bytes: await this.storage.read(doc.storageKey) };
  }

  async reviewDocument(adminId: string, userId: string, documentId: string, status: 'verified' | 'replace_requested', note: string) {
    this.admin(adminId);
    if (status === 'replace_requested' && note.trim().length < 8) throw new BadRequestException('Explain what needs to be replaced.');
    const [doc] = await db.update(tutorApplicationDocuments).set({ reviewStatus: status, reviewerNote: note.trim() || null,
      reviewedBy: adminId, reviewedAt: new Date() }).where(and(eq(tutorApplicationDocuments.id, documentId), eq(tutorApplicationDocuments.userId, userId)))
      .returning({ id: tutorApplicationDocuments.id });
    if (!doc) throw new NotFoundException('Document not found.');
    await db.insert(tutorApplicationReviewEvents).values({ userId, reviewerId: adminId, event: `document_${status}`, internalNote: note.trim() || null });
    return { status };
  }

  async decide(adminId: string, userId: string, decision: Decision, applicantMessage: string, internalNote = '') {
    this.admin(adminId);
    if (['needs_info', 'rejected', 'suspended'].includes(decision) && applicantMessage.trim().length < 10) throw new BadRequestException('Add a clear note for the applicant.');
    const application = await this.application(userId);
    if (decision === 'approved') {
      const docs = await db.select({ category: tutorApplicationDocuments.category, reviewStatus: tutorApplicationDocuments.reviewStatus })
        .from(tutorApplicationDocuments).where(eq(tutorApplicationDocuments.userId, userId));
      const hasVerifiedTranscript = docs.some((d) => d.category === 'transcript' && d.reviewStatus === 'verified');
      const requiredEvidence = application.applicantType === 'student' ? 'enrollment_proof' : 'degree_certificate';
      if (!hasVerifiedTranscript || !docs.some((d) => d.category === requiredEvidence && d.reviewStatus === 'verified')) {
        const evidenceLabel = requiredEvidence === 'enrollment_proof' ? 'proof of current enrollment' : 'a degree certificate';
        throw new BadRequestException(`Verify a transcript and ${evidenceLabel} before approving this tutor.`);
      }
    }
    if (!['in_review', 'submitted'].includes(application.status)) throw new ConflictException('Only a submitted application can receive a final review decision.');
    const notification = await db.transaction(async (tx) => {
      await tx.update(tutorApplications).set({ status: decision, reviewedBy: adminId, reviewedAt: new Date(),
        applicantMessage: applicantMessage.trim() || null, internalReviewNote: internalNote.trim() || null, updatedAt: new Date() })
        .where(eq(tutorApplications.userId, userId));
      await tx.update(tutorProfiles).set({ approval: decision === 'approved' ? 'approved' : decision === 'suspended' ? 'suspended' : decision === 'rejected' ? 'rejected' : 'pending',
        reviewedBy: adminId, reviewedAt: new Date(), reviewNote: applicantMessage.trim() || null, updatedAt: new Date() }).where(eq(tutorProfiles.userId, userId));
      if (decision === 'approved') await tx.update(users).set({ activeRole: 'tutor', updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.insert(tutorApplicationReviewEvents).values({ userId, reviewerId: adminId, event: decision,
        applicantMessage: applicantMessage.trim() || null, internalNote: internalNote.trim() || null });
      const [createdNotification] = await tx.insert(userNotifications).values({ userId, kind: `tutor_application_${decision}`,
        title: decision === 'approved' ? 'Your teaching profile is ready' : 'A note about your tutor application',
        body: applicantMessage.trim() || 'Your tutor application has been approved. You can now respond to learner requests.', targetPath: '/become-tutor' }).returning();
      const [account] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      if (account?.email) {
        const outcome = decision === 'approved'
          ? 'Your tutor application has been approved. Your profile is now eligible to appear to learners in the subjects you selected.'
          : decision === 'needs_info'
            ? 'We need a little more information before we can finish reviewing your tutor application.'
            : decision === 'suspended'
              ? 'Your tutor profile has been paused while our team reviews an account matter.'
              : 'We are unable to approve your tutor application at this time.';
        await tx.insert(emailOutbox).values({
          recipient: account.email,
          subject: decision === 'approved' ? 'Your Juniper tutor profile is approved' : 'An update on your Juniper tutor application',
          textBody: `Hello,\n\n${outcome}${applicantMessage.trim() ? `\n\nA note from our team:\n${applicantMessage.trim()}` : ''}\n\nSign in to Juniper to view your tutor setup: ${process.env.APP_PUBLIC_URL ?? 'http://localhost:8081'}/become-tutor\n\nThe Juniper team`,
        });
      }
      return createdNotification;
    });
    if (notification) this.marketplace.dispatchNotification(userId, notification);
    return { status: decision, previousStatus: application.status };
  }

  private async application(userId: string) {
    const [app] = await db.select().from(tutorApplications).where(eq(tutorApplications.userId, userId)).limit(1);
    if (!app) throw new NotFoundException('Tutor application not found.');
    return app;
  }

  private async requireVerifiedTutor(userId: string) {
    const [user] = await db.select({ signupRole: users.signupRole, emailVerifiedAt: users.emailVerifiedAt }).from(users)
      .where(and(eq(users.id, userId), isNull(users.disabledAt))).limit(1);
    if (!user) throw new NotFoundException('Account not found.');
    if (!user.emailVerifiedAt) throw new ForbiddenException('Verify your email before completing a tutor application.');
    if (user.signupRole !== 'tutor') throw new ForbiddenException('This page is for tutor accounts.');
  }

  private draftText(value: unknown, max: number) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' || value.length > max) throw new BadRequestException('Check your application details.');
    return value.trim();
  }
  private optionalText(value: unknown, max: number) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null; }
  private stringArray(value: unknown, label: string, max: number) {
    if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 100)) throw new BadRequestException(`Choose valid ${label}.`);
    return [...new Set((value as string[]).map((item) => item.trim()))];
  }
  private safeFileName(value?: string) { return (value ?? '').replace(/[\\/\0-\x1f]/g, '').slice(0, 180) || 'tutor-document'; }
  private detectMime(buffer: Buffer) {
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
    if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    return null;
  }
}
