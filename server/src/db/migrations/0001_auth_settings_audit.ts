import { sql, type Kysely } from 'kysely';

/**
 * Accounts, sessions, two-factor, studio settings and the audit log.
 * Roles (younes_migrator owns the schema, younes_app reads and writes
 * data) come from docker/postgres/init; the app role's default grants
 * are set there, and narrowed here where a table must stay append-only.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table users (
      id uuid primary key default gen_random_uuid(),
      email citext not null unique,
      name text not null check (length(name) between 1 and 120),
      password_hash text not null,
      role text not null default 'owner' check (role in ('owner', 'staff')),
      totp_secret_enc text,
      totp_enabled_at timestamptz,
      -- the last 30-second step a code was accepted for: no code works twice
      totp_last_step bigint,
      password_changed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      disabled_at timestamptz
    );
    -- one owner, today: a second can't be created by any path
    create unique index users_single_owner on users ((role)) where role = 'owner' and disabled_at is null;

    create table sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users on delete cascade,
      token_hash bytea not null unique,
      mfa_passed boolean not null default false,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      idle_expires_at timestamptz not null,
      absolute_expires_at timestamptz not null,
      revoked_at timestamptz,
      ip text,
      user_agent text
    );
    create index sessions_user_active on sessions (user_id) where revoked_at is null;

    create table password_resets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users on delete cascade,
      token_hash bytea not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table recovery_codes (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users on delete cascade,
      code_hash bytea not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index recovery_codes_user on recovery_codes (user_id) where used_at is null;

    create table auth_attempts (
      key text primary key,
      failures integer not null default 0,
      window_start timestamptz not null,
      locked_until timestamptz
    );

    create table studio_settings (
      id smallint primary key default 1 check (id = 1),
      studio_name text not null default 'Younes Tattoo',
      timezone text not null default 'America/Detroit',
      notify_email citext,
      retention_months integer not null default 24 check (retention_months between 1 and 120),
      ai_daily_budget_usd numeric(10, 2) not null default 1.00 check (ai_daily_budget_usd >= 0),
      ai_monthly_budget_usd numeric(10, 2) not null default 10.00 check (ai_monthly_budget_usd >= 0),
      updated_at timestamptz not null default now()
    );
    insert into studio_settings default values;

    create table activity_log (
      id bigint generated always as identity primary key,
      at timestamptz not null default now(),
      actor_type text not null check (actor_type in ('user', 'website', 'assistant', 'system')),
      actor_id uuid,
      action text not null,
      subject_type text,
      subject_id text,
      data jsonb not null default '{}'
    );
    create index activity_log_at on activity_log (at desc);
    create index activity_log_subject on activity_log (subject_type, subject_id);
    -- the history can be added to and read, never rewritten
    revoke update, delete, truncate on activity_log from younes_app;
    create function activity_log_append_only() returns trigger language plpgsql as $$
      begin raise exception 'activity_log is append-only'; end;
    $$;
    create trigger activity_log_no_update before update or delete on activity_log
      for each row execute function activity_log_append_only();
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists activity_log;
    drop function if exists activity_log_append_only();
    drop table if exists studio_settings;
    drop table if exists auth_attempts;
    drop table if exists recovery_codes;
    drop table if exists password_resets;
    drop table if exists sessions;
    drop table if exists users;
  `.execute(db);
}
