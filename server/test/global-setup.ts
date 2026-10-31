import { loadEnvFiles } from '../src/config.ts';
import { createDb } from '../src/db/index.ts';
import { migrateToLatest } from '../src/db/migrate.ts';

/**
 * Once per run: the test database's schema brought up to date, by the
 * migrator role - against the real Postgres (docker/compose.yaml). No
 * mocks stand in for the database anywhere in these tests.
 */
export default async function setup() {
  loadEnvFiles();
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url || !process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL / TEST_MIGRATION_DATABASE_URL are missing - run npm run setup');
  if (!new URL(url).pathname.endsWith('_test')) throw new Error('Refusing to run tests against a database not named *_test');
  const db = createDb(url, { max: 1, applicationName: 'younes-test-setup' });
  try {
    await migrateToLatest(db, true);
  } catch (e) {
    throw new Error(`The test database isn't reachable or can't be migrated. Is Docker running (npm run db:up)?\n${(e as Error).message}`);
  } finally {
    await db.destroy();
  }
}
