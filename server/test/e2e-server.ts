import { rm } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'kysely';
import { loadEnvFiles, REPO_ROOT } from '../src/config.ts';
import { createDb } from '../src/db/index.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seedContent, seedDemo } from '../src/db/seed/index.ts';
import { diskStorage } from '../src/lib/storage.ts';

/**
 * The API for the browser tests (playwright.config.ts): the real server on
 * the *test* database, emptied and re-seeded first (the site's content and
 * the demo records), no owner yet - the tests create it through the
 * first-run screen. Its own port, its own storage folder; the dev
 * database and storage are never touched. AI and the email worker are
 * off; nothing leaves this machine.
 */

loadEnvFiles();
const url = process.env.TEST_DATABASE_URL;
const adminUrl = process.env.TEST_MIGRATION_DATABASE_URL;
if (!url || !adminUrl) throw new Error('TEST_DATABASE_URL / TEST_MIGRATION_DATABASE_URL are missing - run npm run setup');
if (!new URL(url).pathname.endsWith('_test') || !new URL(adminUrl).pathname.endsWith('_test')) throw new Error('Refusing to run the browser tests against a database not named *_test');

const storageDir = path.join(REPO_ROOT, 'test-results', 'e2e-storage');
await rm(storageDir, { recursive: true, force: true });

const admin = createDb(adminUrl, { max: 1, applicationName: 'younes-e2e-setup' });
await migrateToLatest(admin, true);
const tables = await sql<{ tablename: string }>`select tablename from pg_tables where schemaname = 'public' and tablename not like 'kysely_%'`.execute(admin);
await sql`truncate ${sql.join(tables.rows.map((t) => sql.id(t.tablename)))} restart identity cascade`.execute(admin);
await sql`insert into studio_settings default values`.execute(admin);
await admin.destroy();

const db = createDb(url, { max: 2, applicationName: 'younes-e2e-seed' });
await seedContent(db, diskStorage(storageDir));
await seedDemo(db);
await db.destroy();

Object.assign(process.env, {
  // development: the site is Vite's, which injects the published content (as in local dev)
  NODE_ENV: 'development',
  DATABASE_URL: url,
  MIGRATION_DATABASE_URL: adminUrl,
  PORT: process.env.E2E_API_PORT ?? '3101',
  PUBLIC_ORIGIN: process.env.E2E_ORIGIN ?? 'http://localhost:5301',
  STORAGE_DIR: storageDir,
  OWNER_SETUP_TOKEN: 'e2e-setup-token-0123456789abcdef',
  // the browser tests walk the full sign-in, whatever server/.env says
  TWO_FACTOR: 'true',
  WORKER_ENABLED: 'false',
  SERVE_SITE: 'false',
  AI_ENABLED: 'false',
  RATE_LIMITS: 'false',
  LOG_LEVEL: 'warn',
});
await import('../src/main.ts');
