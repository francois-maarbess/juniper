import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tutorProfiles, users } from './users';

export const requestStatus = pgEnum('request_status', [
  'open',
  'matched',
  'in_progress',
  'completed',
  'cancelled',
]);

export const bookingStatus = pgEnum('booking_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);
export const paymentMethod = pgEnum('payment_method', ['cash', 'whish', 'omt']);
export const paymentStatus = pgEnum('payment_status', ['pending', 'reported_paid_by_learner', 'confirmed_by_tutor']);

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    category: text('category').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [uniqueIndex('subjects_slug_unique').on(table.slug)],
);

export const tutorSubjects = pgTable(
  'tutor_subjects',
  {
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
    level: text('level').notNull().default('all'),
  },
  (table) => [uniqueIndex('tutor_subjects_pk').on(table.tutorId, table.subjectId)],
);

export const studyRequests = pgTable(
  'study_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    learnerId: uuid('learner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'restrict' }),
    customSubject: text('custom_subject'),
    customCourse: text('custom_course'),
    university: text('university'),
    instructionLanguage: text('instruction_language'),
    helpType: text('help_type').notNull().default('tutoring'),
    title: text('title').notNull(),
    details: text('details').notNull(),
    level: text('level'),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    preferredTimes: text('preferred_times').array().notNull().default(sql`'{}'::text[]`),
    sessionDurationMinutes: integer('session_duration_minutes').notNull().default(60),
    serviceType: text('service_type').notNull().default('assignment_project'),
    targetGrade: text('target_grade').notNull().default('not_specified'),
    gradeGuarantee: boolean('grade_guarantee').notNull().default(false),
    budgetCents: integer('budget_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    targetTutorId: uuid('target_tutor_id').references(() => tutorProfiles.userId, { onDelete: 'set null' }),
    status: requestStatus('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_requests_board_idx').on(table.status, table.subjectId, table.deadline),
    index('study_requests_learner_idx').on(table.learnerId, table.createdAt),
    index('study_requests_target_tutor_idx').on(table.targetTutorId, table.status),
  ],
);

export const requestAttachments = pgTable(
  'request_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull().references(() => studyRequests.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('request_attachments_request_idx').on(table.requestId)],
);

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull().references(() => studyRequests.id, { onDelete: 'cascade' }),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    note: text('note').notNull(),
    turnaroundHours: integer('turnaround_hours'),
    includesWalkthrough: boolean('includes_walkthrough').notNull().default(true),
    gradeCommitment: text('grade_commitment'),
    estimatedMinutes: integer('estimated_minutes'),
    proposedAt: timestamp('proposed_at', { withTimezone: true }),
    offerType: text('offer_type').notNull().default('hourly'),
    packageSessionCount: integer('package_session_count'),
    packageDescription: text('package_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('offers_request_tutor_unique').on(table.requestId, table.tutorId),
    index('offers_request_created_idx').on(table.requestId, table.createdAt),
  ],
);

export const offerMessages = pgTable(
  'offer_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('offer_messages_offer_created_idx').on(table.offerId, table.createdAt)],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull().references(() => studyRequests.id, { onDelete: 'restrict' }),
    offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'restrict' }),
    learnerId: uuid('learner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    paymentMethodAgreed: paymentMethod('payment_method_agreed'),
    paymentStatus: paymentStatus('payment_status').notNull().default('pending'),
    paymentReceiptStorageKey: text('payment_receipt_storage_key'),
    paymentReceiptFileName: text('payment_receipt_file_name'),
    paymentReceiptMimeType: text('payment_receipt_mime_type'),
    paymentReceiptSizeBytes: integer('payment_receipt_size_bytes'),
    paymentReportedAt: timestamp('payment_reported_at', { withTimezone: true }),
    paymentConfirmedAt: timestamp('payment_confirmed_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    serviceType: text('service_type').notNull().default('assignment_project'),
    targetGrade: text('target_grade').notNull().default('not_specified'),
    gradeGuarantee: boolean('grade_guarantee').notNull().default(false),
    solutionSummary: text('solution_summary'),
    explanationWalkthrough: text('explanation_walkthrough'),
    deliverables: jsonb('deliverables').$type<Array<{ title: string; url?: string; description?: string }>>().notNull().default(sql`'[]'::jsonb`),
    escrowStatus: text('escrow_status').notNull().default('not_configured'),
    revisionNotes: text('revision_notes'),
    revisionRequestedAt: timestamp('revision_requested_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    learningRecap: text('learning_recap'),
    nextSteps: text('next_steps'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: bookingStatus('status').notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bookings_request_unique').on(table.requestId),
    index('bookings_learner_idx').on(table.learnerId, table.createdAt),
    index('bookings_tutor_idx').on(table.tutorId, table.createdAt),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('conversations_booking_unique').on(table.bookingId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    text: text('text').notNull(),
    attachments: jsonb('attachments').$type<string[]>().notNull().default([]),
    messageType: text('message_type').notNull().default('text'),
    audioUrl: text('audio_url'),
    audioDurationSeconds: integer('audio_duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [index('messages_conversation_created_idx').on(table.conversationId, table.createdAt)],
);

export const messageAttachments = pgTable('message_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('message_attachments_booking_idx').on(table.bookingId, table.createdAt),
  index('message_attachments_staged_created_idx').on(table.createdAt).where(sql`${table.messageId} IS NULL`),
]);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'restrict' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reviews_booking_reviewer_unique').on(table.bookingId, table.reviewerId),
    index('reviews_tutor_created_idx').on(table.tutorId, table.createdAt),
  ],
);

export const tutorTags = pgTable(
  'tutor_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    tagString: text('tag_string').notNull(),
    endorsementCount: integer('endorsement_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tutor_tags_tutor_tag_unique').on(table.tutorId, table.tagString),
    index('tutor_tags_tutor_count_idx').on(table.tutorId, table.endorsementCount),
  ],
);

export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    targetPath: text('target_path'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('user_notifications_inbox_idx').on(table.userId, table.createdAt)],
);

// Persistent buckets keep abuse limits consistent when the API runs on more than one process.
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

export const userPushTokens = pgTable('user_push_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  platform: text('platform').notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_push_tokens_token_unique').on(table.token),
  index('user_push_tokens_user_idx').on(table.userId),
]);

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  textBody: text('text_body').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (table) => [index('email_outbox_pending_idx').on(table.status, table.nextAttemptAt)]);

export const dayOfWeek = pgEnum('day_of_week', [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

export const universityCourses = pgTable(
  'university_courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    university: text('university').notNull(), // 'AUB' | 'LAU' | 'CNAM' | 'LU' | 'USJ' | 'BAU' | 'OTHER'
    code: text('code').notNull(), // 'MATH201', 'NFA031', 'EECE210', etc.
    name: text('name').notNull(),
    department: text('department'),
    credits: integer('credits'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('university_courses_uni_code_unique').on(table.university, table.code),
    index('university_courses_code_idx').on(table.code),
    index('university_courses_uni_idx').on(table.university),
  ],
);

export const tutorCourses = pgTable(
  'tutor_courses',
  {
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => universityCourses.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('tutor_courses_pk').on(table.tutorId, table.courseId)],
);

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    dayOfWeek: dayOfWeek('day_of_week').notNull(),
    startTime: text('start_time').notNull(), // HH:mm 24-hr format e.g. "10:00"
    endTime: text('end_time').notNull(), // HH:mm 24-hr format e.g. "11:00"
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('availability_slots_tutor_day_idx').on(table.tutorId, table.dayOfWeek),
  ],
);

export const voiceNotes = pgTable(
  'voice_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').references(() => studyRequests.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fileUrl: text('file_url').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('voice_notes_request_idx').on(table.requestId),
    index('voice_notes_booking_idx').on(table.bookingId),
    index('voice_notes_user_idx').on(table.userId),
  ],
);

export const resourceFiles = pgTable(
  'resource_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    url: text('url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('resource_files_owner_idx').on(table.ownerUserId),
    index('resource_files_booking_idx').on(table.bookingId),
  ],
);

export const tutorVaultItems = pgTable(
  'tutor_vault_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorUserId: uuid('tutor_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type').notNull(),
    isPublic: boolean('is_public').notNull().default(true),
    priceCents: integer('price_cents').notNull().default(0),
    purchaseCount: integer('purchase_count').notNull().default(0),
    downloadCount: integer('download_count').notNull().default(0),
    rating: integer('rating'),
    refundCount: integer('refund_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tutor_vault_items_tutor_idx').on(table.tutorUserId),
  ],
);

export const vaultPurchaseStatus = pgEnum('vault_purchase_status', ['pending', 'confirmed']);

export const vaultPurchases = pgTable(
  'vault_purchases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id').notNull().references(() => tutorVaultItems.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: vaultPurchaseStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('vault_purchases_item_buyer_unique').on(table.itemId, table.buyerId),
    index('vault_purchases_item_idx').on(table.itemId),
    index('vault_purchases_buyer_idx').on(table.buyerId),
  ],
);

export const bountyStatus = pgEnum('bounty_status', ['open', 'claimed', 'solved']);

export const microBounties = pgTable(
  'micro_bounties',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    learnerId: uuid('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseTag: text('course_tag').notNull(),
    description: text('description').notNull(),
    imageUrl: text('image_url'),
    bountyAmountCents: integer('bounty_amount_cents').notNull(),
    status: bountyStatus('status').notNull().default('open'),
    claimedByTutorId: uuid('claimed_by_tutor_id').references(() => tutorProfiles.userId, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    solvedAt: timestamp('solved_at', { withTimezone: true }),
  },
  (table) => [
    index('micro_bounties_status_idx').on(table.status, table.createdAt),
    index('micro_bounties_learner_idx').on(table.learnerId, table.createdAt),
  ],
);

export const bountySolutions = pgTable(
  'bounty_solutions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bountyId: uuid('bounty_id').notNull().references(() => microBounties.id, { onDelete: 'cascade' }),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    imageUrl: text('image_url'),
    voiceNoteUrl: text('voice_note_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('bounty_solutions_bounty_idx').on(table.bountyId, table.createdAt)],
);

// --- Phase 0: WebRTC signaling + presence ---

export const webrtcSessionStatus = pgEnum('webrtc_session_status', [
  'initiating', 'connecting', 'connected', 'disconnected', 'failed', 'ended',
]);

export const userPresenceStatus = pgEnum('user_presence_status', ['online', 'away', 'offline']);

export const webrtcSessions = pgTable(
  'webrtc_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    initiatorId: uuid('initiator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    responderId: uuid('responder_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sdpOffer: text('sdp_offer'),
    sdpAnswer: text('sdp_answer'),
    iceCandidates: jsonb('ice_candidates').notNull().default(sql`'[]'::jsonb`),
    status: webrtcSessionStatus('status').notNull().default('initiating'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('webrtc_sessions_booking_idx').on(table.bookingId, table.createdAt),
    index('webrtc_sessions_initiator_idx').on(table.initiatorId),
  ],
);

export const userPresence = pgTable(
  'user_presence',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    socketId: text('socket_id'),
    status: userPresenceStatus('status').notNull().default('offline'),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    currentBookingId: uuid('current_booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  },
  (table) => [index('user_presence_status_idx').on(table.status)],
);

// --- Phase 0: AI pipeline ---

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    title: text('title').notNull().default('New conversation'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_conversations_user_idx').on(table.userId, table.createdAt),
    index('ai_conversations_booking_idx').on(table.bookingId),
  ],
);

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').$type<'user' | 'assistant' | 'system'>().notNull(),
    content: text('content').notNull(),
    model: text('model'),
    tokens: integer('tokens'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('ai_messages_conversation_idx').on(table.conversationId, table.createdAt)],
);

// --- Phase 1: Live collaborative workroom ---

export const whiteboardElementType = pgEnum('whiteboard_element_type', [
  'stroke', 'shape', 'text', 'math', 'image', 'sticky',
]);

export const workroomWhiteboards = pgTable(
  'workroom_whiteboards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    elements: jsonb('elements').notNull().default(sql`'[]'::jsonb`),
    version: integer('version').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [uniqueIndex('workroom_whiteboards_booking_unique').on(table.bookingId)],
);

export const recordingStatus = pgEnum('recording_status', ['recording', 'processing', 'ready', 'failed']);

export const workroomRecordings = pgTable(
  'workroom_recordings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    url: text('url'),
    durationSeconds: integer('duration_seconds'),
    status: recordingStatus('status').notNull().default('recording'),
    startedBy: uuid('started_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [index('workroom_recordings_booking_idx').on(table.bookingId, table.createdAt)],
);

// --- Phase 2: Smart tutor matching ---

export const tutorAvailabilityWindows = pgTable(
  'tutor_availability_windows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0=Sun..6=Sat
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(),
    isRecurring: boolean('is_recurring').notNull().default(true),
    exceptionDate: timestamp('exception_date', { withTimezone: true }),
    exceptionStart: text('exception_start'),
    exceptionEnd: text('exception_end'),
  },
  (table) => [index('tutor_avail_tutor_day_idx').on(table.tutorId, table.dayOfWeek)],
);

export const slotStatus = pgEnum('slot_status', ['open', 'held', 'booked', 'cancelled']);

export const bookingSlots = pgTable(
  'booking_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    priceCents: integer('price_cents').notNull().default(0),
    status: slotStatus('status').notNull().default('open'),
    bookedBy: uuid('booked_by').references(() => users.id, { onDelete: 'set null' }),
    bookedAt: timestamp('booked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('booking_slots_tutor_start_idx').on(table.tutorId, table.startAt),
    index('booking_slots_status_idx').on(table.status, table.startAt),
  ],
);

export const tutorReviewSkills = pgTable(
  'tutor_review_skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
    skillTag: text('skill_tag').notNull(),
    rating: integer('rating').notNull(),
  },
  (table) => [index('tutor_review_skills_review_idx').on(table.reviewId)],
);

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    learnerId: uuid('learner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    subject: text('subject'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('waitlist_tutor_learner_unique').on(table.tutorId, table.learnerId)],
);

// --- Phase 4: Group sessions & community ---

export const groupClassStatus = pgEnum('group_class_status', ['scheduled', 'live', 'completed', 'cancelled']);
export const enrollmentStatus = pgEnum('enrollment_status', ['enrolled', 'attended', 'no_show', 'refunded']);

export const groupClasses = pgTable(
  'group_classes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    subject: text('subject').notNull(),
    description: text('description'),
    pricePerStudentCents: integer('price_per_student_cents').notNull().default(0),
    maxStudents: integer('max_students').notNull().default(10),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    status: groupClassStatus('status').notNull().default('scheduled'),
    recordingUrl: text('recording_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('group_classes_tutor_idx').on(table.tutorId, table.scheduledAt),
    index('group_classes_status_idx').on(table.status, table.scheduledAt),
  ],
);

export const groupEnrollments = pgTable(
  'group_enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id').notNull().references(() => groupClasses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: enrollmentStatus('status').notNull().default('enrolled'),
    paidCents: integer('paid_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('group_enrollments_class_student_unique').on(table.classId, table.studentId)],
);

export const communityQuestions = pgTable(
  'community_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    imageUrl: text('image_url'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('community_questions_subject_idx').on(table.subject, table.createdAt),
    index('community_questions_author_idx').on(table.authorId),
  ],
);

export const communityAnswers = pgTable(
  'community_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id').notNull().references(() => communityQuestions.id, { onDelete: 'cascade' }),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    upvotes: integer('upvotes').notNull().default(0),
    accepted: boolean('accepted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('community_answers_question_idx').on(table.questionId, table.createdAt)],
);

// --- Phase 5: Tutor Business OS ---

export const calendarEventType = pgEnum('calendar_event_type', ['session', 'group_class', 'office_hours', 'blocked']);
export const invoiceStatus = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']);

export const tutorCalendarEvents = pgTable(
  'tutor_calendar_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: calendarEventType('type').notNull().default('session'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    studentId: uuid('student_id').references(() => users.id, { onDelete: 'set null' }),
    classId: uuid('class_id').references(() => groupClasses.id, { onDelete: 'set null' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('tutor_calendar_tutor_start_idx').on(table.tutorId, table.startAt)],
);

export const tutorInvoices = pgTable(
  'tutor_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tutorId: uuid('tutor_id').notNull().references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    status: invoiceStatus('status').notNull().default('draft'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tutor_invoices_tutor_idx').on(table.tutorId, table.createdAt),
    index('tutor_invoices_student_idx').on(table.studentId),
  ],
);


