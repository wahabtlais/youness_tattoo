import { Migrator, NO_MIGRATIONS, type Migration, type MigrationResultSet } from 'kysely/migration';
import type { DB } from './index.ts';
import * as m0001 from './migrations/0001_auth_settings_audit.ts';
import * as m0002 from './migrations/0002_media_content.ts';
import * as m0003 from './migrations/0003_clients_inquiries.ts';
import * as m0004 from './migrations/0004_calendar.ts';
import * as m0005 from './migrations/0005_outbox_ai.ts';
import * as m0006 from './migrations/0006_trusted_devices.ts';

/**
 * The migrations, listed in code (not read from a folder) so they survive
 * bundling. Add a file, add it here. Each runs in a transaction; each has a
 * `down`. None is irreversible today - a `down` that loses data must say
 * so at its top and in server/README.md.
 */
export const MIGRATIONS: Record<string, Migration> = {
  '0001_auth_settings_audit': m0001,
  '0002_media_content': m0002,
  '0003_clients_inquiries': m0003,
  '0004_calendar': m0004,
  '0005_outbox_ai': m0005,
  '0006_trusted_devices': m0006,
};

export const migrator = (db: DB) => new Migrator({ db, provider: { getMigrations: async () => MIGRATIONS } });

function check(r: MigrationResultSet) {
  for (const it of r.results ?? []) console.log(`  ${it.status === 'Success' ? '✓' : '✗'} ${it.direction === 'Up' ? 'up  ' : 'down'} ${it.migrationName}`);
  if (r.error) throw r.error;
}

export async function migrateToLatest(db: DB, quiet = false) {
  const r = await migrator(db).migrateToLatest();
  if (!quiet) check(r);
  else if (r.error) throw r.error;
}

export async function migrateDown(db: DB) {
  check(await migrator(db).migrateDown());
}

/** every migration down, in reverse - the schema back to empty */
export async function migrateToZero(db: DB, quiet = false) {
  const r = await migrator(db).migrateTo(NO_MIGRATIONS);
  if (!quiet) check(r);
  else if (r.error) throw r.error;
}
