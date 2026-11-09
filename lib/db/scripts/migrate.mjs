import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set before applying Juniper database migrations.');

const { Client } = pg;
const client = new Client({ connectionString });
const here = path.dirname(fileURLToPath(import.meta.url));
let connected = false;
let lockAcquired = false;
let transactionStarted = false;

try {
  await client.connect();
  connected = true;
  await client.query('SELECT pg_advisory_lock(74120318)');
  lockAcquired = true;
  await client.query(`CREATE TABLE IF NOT EXISTS juniper_schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const migrationDirectory = path.join(here, '..', 'migrations');
  const migrations = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  for (const name of migrations) {
    const applied = await client.query('SELECT name FROM juniper_schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount) continue;
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(await readFile(path.join(migrationDirectory, name), 'utf8'));
    await client.query('INSERT INTO juniper_schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
    await client.query('COMMIT');
    transactionStarted = false;
    console.info(`Applied Juniper migration ${name}.`);
  }
  console.info('Juniper database migrations are up to date.');
} catch (error) {
  if (connected && transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  if (connected && lockAcquired) await client.query('SELECT pg_advisory_unlock(74120318)').catch(() => undefined);
  if (connected) await client.end().catch(() => undefined);
}
