import {
  boolean,
  integer,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const teachingStyle = pgEnum('teaching_style', ['socratic', 'direct', 'demo', 'hybrid']);

export const tutorApproval = pgEnum('tutor_approval', [
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended',
  'suspended_pending_subscription',
]);

export const tutorApplicationStatus = pgEnum('tutor_application_status', [
  'draft', 'submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'suspended',
]);
export const tutorDocumentCategory = pgEnum('tutor_document_category', [
  'transcript', 'degree_certificate', 'enrollment_proof', 'teaching_certificate', 'cv', 'portfolio_evidence', 'other',
]);
export const tutorDocumentReviewStatus = pgEnum('tutor_document_review_status', [
  'pending', 'verified', 'replace_requested',
]);

export const oneTimeTokenPurpose = pgEnum('one_time_token_purpose', [
  'verify_email',
  'reset_password',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    activeRole: text('active_role').$type<'student' | 'tutor'>().notNull().default('student'),
    signupRole: text('signup_role').$type<'student' | 'tutor'>().notNull().default('student'),
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_is_admin_idx').on(table.isAdmin),
  ],
);

export const tutorApplications = pgTable(
  'tutor_applications',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull().default(''),
    applicantType: text('applicant_type').notNull().default('graduate'),
    country: text('country'),
    degreeLevel: text('degree_level'),
    institution: text('institution'),
    fieldOfStudy: text('field_of_study'),
    graduationYear: integer('graduation_year'),
    gradeValue: text('grade_value'),
    gradeScale: text('grade_scale'),
    yearsExperience: integer('years_experience'),
    languages: text('languages').array().notNull().default(sql`'{}'::text[]`),
    status: tutorApplicationStatus('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    applicantMessage: text('applicant_message'),
    internalReviewNote: text('internal_review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tutor_applications_status_created_idx').on(table.status, table.createdAt)],
);

export const tutorApplicationDocuments = pgTable(
  'tutor_application_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => tutorApplications.userId, { onDelete: 'cascade' }),
    category: tutorDocumentCategory('category').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    reviewStatus: tutorDocumentReviewStatus('review_status').notNull().default('pending'),
    reviewerNote: text('reviewer_note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tutor_application_documents_user_idx').on(table.userId, table.createdAt)],
);

export const tutorApplicationReviewEvents = pgTable(
  'tutor_application_review_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => tutorApplications.userId, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    event: text('event').notNull(),
    applicantMessage: text('applicant_message'),
    internalNote: text('internal_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tutor_application_review_events_user_idx').on(table.userId, table.createdAt)],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceName: text('device_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('auth_sessions_refresh_hash_unique').on(table.refreshTokenHash),
    index('auth_sessions_user_active_idx').on(table.userId, table.expiresAt),
  ],
);

export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    purpose: oneTimeTokenPurpose('purpose').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('one_time_tokens_hash_unique').on(table.tokenHash),
    index('one_time_tokens_user_purpose_idx').on(table.userId, table.purpose),
  ],
);

export const learnerProfiles = pgTable('learner_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  gradeLevel: text('grade_level'),
  timezone: text('timezone').default('UTC').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tutorProfiles = pgTable(
  'tutor_profiles',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    headline: text('headline'),
    biography: text('biography'),
    educationSummary: text('education_summary'),
    hourlyRateCents: integer('hourly_rate_cents').notNull().default(0),
    availability: text('availability').array().notNull().default(sql`'{}'::text[]`),
    timezone: text('timezone').notNull().default('UTC'),
    levels: text('levels').array().notNull().default(sql`'{}'::text[]`),
    customSubjects: text('custom_subjects').array().notNull().default(sql`'{}'::text[]`),
    customCourses: text('custom_courses').array().notNull().default(sql`'{}'::text[]`),
    customUniversities: text('custom_universities').array().notNull().default(sql`'{}'::text[]`),
    approval: tutorApproval('approval').notNull().default('draft'),
    subscriptionPaid: boolean('subscription_paid').notNull().default(false),
    freePeriodEndsAt: timestamp('free_period_ends_at', { withTimezone: true }).notNull().default(sql`now() + interval '30 days'`),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),
    yearsExperience: integer('years_experience'),
    responseTimeMinutes: integer('response_time_minutes'),
    businessName: text('business_name'),
    taxId: text('tax_id'),
    stripeConnectAccountId: text('stripe_connect_account_id'),
    teachingStyle: teachingStyle('teaching_style').default('hybrid'),
    maxStudents: integer('max_students').default(1),
    videoEnabled: boolean('video_enabled').notNull().default(true),
    groupEnabled: boolean('group_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tutor_profiles_approval_idx').on(table.approval)],
);

export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
