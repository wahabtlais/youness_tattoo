import { sql, type Kysely } from 'kysely';

/**
 * Browsers the owner has fully signed in on (password and second step).
 * The browser keeps a random token in an HttpOnly cookie; only its hash is
 * stored. Sign-in from a trusted browser isn't held up by the account-wide
 * lockout - which anyone who knows the owner's email can trigger - but has
 * its own failure limit (auth_attempts key `device:<id>`).
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table trusted_devices (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users on delete cascade,
      token_hash bytea not null unique,
      created_at timestamptz not null default now(),
      last_used_at timestamptz not null default now(),
      expires_at timestamptz not null,
      revoked_at timestamptz,
      user_agent text
    );
    create index trusted_devices_user_active on trusted_devices (user_id) where revoked_at is null;
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table if exists trusted_devices;`.execute(db);
}
