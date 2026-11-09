import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
// @ts-ignore
import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.logger.warn('DATABASE_URL is not set. Skipping automatic migrations.');
      return;
    }

    const { Client } = pg;
    const client = new Client({ connectionString });
    let connected = false;

    try {
      await client.connect();
      connected = true;

      await client.query(`CREATE TABLE IF NOT EXISTS juniper_schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

      const migrationDirs = [
        resolve(process.cwd(), 'lib/db/migrations'),
        resolve(process.cwd(), '../../lib/db/migrations'),
        resolve(process.cwd(), '../lib/db/migrations'),
      ];

      let migrationDir: string | null = null;
      for (const dir of migrationDirs) {
        try {
          await readdir(dir);
          migrationDir = dir;
          break;
        } catch {
          // try next
        }
      }

      if (!migrationDir) {
        this.logger.warn('Migrations directory not found, running inline fallback migrations.');
        await this.runFallback(client);
        return;
      }

      const files = (await readdir(migrationDir))
        .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
        .sort((a, b) => a.localeCompare(b));

      for (const name of files) {
        const applied = await client.query('SELECT name FROM juniper_schema_migrations WHERE name = $1', [name]);
        if (applied.rowCount && applied.rowCount > 0) continue;

        const sql = await readFile(join(migrationDir, name), 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO juniper_schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
        await client.query('COMMIT');
        this.logger.log(`Applied database migration: ${name}`);
      }

      this.logger.log('Database schema migrations verified and up to date.');
    } catch (err) {
      this.logger.error(`Migration error: ${(err as Error).message}`);
    } finally {
      if (connected) await client.end().catch(() => undefined);
    }
  }

  private async runFallback(client: pg.Client) {
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS voice_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          request_id UUID REFERENCES study_requests(id) ON DELETE CASCADE,
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          file_url TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS resource_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS tutor_vault_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tutor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          file_url TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          is_public BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER;
        ALTER TABLE offers ADD COLUMN IF NOT EXISTS offer_type TEXT NOT NULL DEFAULT 'hourly';
        ALTER TABLE offers ADD COLUMN IF NOT EXISTS package_session_count INTEGER;
        ALTER TABLE offers ADD COLUMN IF NOT EXISTS package_description TEXT;
      `);
      this.logger.log('Fallback migrations executed successfully.');
    } catch (e) {
      this.logger.warn(`Fallback migration warning: ${(e as Error).message}`);
    }
  }
}
