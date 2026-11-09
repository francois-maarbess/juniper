import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL before creating a database backup.');
const databaseUrl = new URL(connectionString);
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');

const outputDirectory = path.resolve(projectRoot, process.env.DATABASE_BACKUP_DIR ?? '.backups');
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(outputDirectory, `juniper-${timestamp}.dump`);
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
const environment = { ...process.env };
if (databaseUrl.password) environment.PGPASSWORD = decodeURIComponent(databaseUrl.password);
const sslMode = databaseUrl.searchParams.get('sslmode');
if (sslMode) environment.PGSSLMODE = sslMode;
const args = [
  '--format=custom', '--no-owner', '--no-acl',
  '--host', databaseUrl.hostname,
  '--port', String(databaseUrl.port || 5432),
  '--username', decodeURIComponent(databaseUrl.username),
  '--dbname', databaseName,
];

process.umask(0o077);
try {
  await new Promise((resolve, reject) => {
    const child = spawn('pg_dump', [...args, '--file', outputPath], { env: environment, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with status ${code ?? 'unknown'}.`)));
  });
} catch (error) {
  await rm(outputPath, { force: true });
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    if (['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
      const container = process.env.JUNIPER_POSTGRES_DOCKER_CONTAINER ?? 'juniper-postgres';
      const docker = spawn('docker', [
        'exec', '--env', `PGUSER=${decodeURIComponent(databaseUrl.username)}`,
        '--env', `PGDATABASE=${databaseName}`, container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl --host=127.0.0.1 --port=5432',
      ], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
      const writeTask = pipeline(docker.stdout, createWriteStream(outputPath, { mode: 0o600 }));
      const exitTask = new Promise((resolve, reject) => {
        docker.once('error', reject);
        docker.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Docker backup exited with status ${code ?? 'unknown'}.`)));
      });
      try {
        await Promise.all([writeTask, exitTask]);
      } catch (fallbackError) {
        await rm(outputPath, { force: true });
        throw new Error(`pg_dump was not found and the local PostgreSQL container backup failed: ${fallbackError instanceof Error ? fallbackError.message : 'Docker error'}`);
      }
    } else {
      throw new Error('pg_dump was not found on PATH. Install the PostgreSQL command-line tools, then retry the backup.');
    }
  } else {
    throw error;
  }
}
const backupStat = await stat(outputPath);
if (backupStat.size === 0) {
  await rm(outputPath, { force: true });
  throw new Error('pg_dump created an empty backup.');
}
console.info(`Database backup created: ${path.relative(projectRoot, outputPath)} (${backupStat.size} bytes).`);
