import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';
import type { Database } from './types.ts';

export type DB = Kysely<Database>;
export type Tx = Transaction<Database>;
/** a service runs on the database or inside a caller's transaction */
export type Executor = DB | Tx;

// timestamps come back as Date; dates (yyyy-mm-dd) and numerics stay strings - no timezone shifts
pg.types.setTypeParser(1082, (v: string) => v);

/**
 * A connection pool sized for one small server: a handful of connections
 * is plenty for a studio, and leaves room for the migrator and psql.
 */
export function createDb(url: string, opts: { max?: number; applicationName?: string } = {}): DB {
  const pool = new pg.Pool({
    connectionString: url,
    max: opts.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: opts.applicationName ?? 'younes-api',
    // a runaway query can't hold a connection forever
    statement_timeout: 15_000,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
