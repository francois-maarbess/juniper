import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Voice Notes
// ---------------------------------------------------------------------------
export const voiceNotes = pgTable('voice_notes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: uuid('request_id').notNull(),
  userId: uuid('user_id').notNull(),
  fileUrl: text('file_url').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type VoiceNote = typeof voiceNotes.$inferSelect;
export type NewVoiceNote = typeof voiceNotes.$inferInsert;

// ---------------------------------------------------------------------------
// Resource Files
// ---------------------------------------------------------------------------
export const resourceFiles = pgTable('resource_files', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ownerUserId: uuid('owner_user_id').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type ResourceFile = typeof resourceFiles.$inferSelect;
export type NewResourceFile = typeof resourceFiles.$inferInsert;

// ---------------------------------------------------------------------------
// Tutor Vault Items  (Epic 4 — placed here for a single schema-additions file)
// ---------------------------------------------------------------------------
export const tutorVaultItems = pgTable('tutor_vault_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tutorUserId: uuid('tutor_user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  fileUrl: text('file_url').notNull(),
  mimeType: text('mime_type').notNull(),
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type TutorVaultItem = typeof tutorVaultItems.$inferSelect;
export type NewTutorVaultItem = typeof tutorVaultItems.$inferInsert;
