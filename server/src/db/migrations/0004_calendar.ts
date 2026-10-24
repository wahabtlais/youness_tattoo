import { sql, type Kysely } from 'kysely';

/**
 * Appointments and opening hours. A proposed or confirmed appointment
 * holds its time: Postgres itself refuses an overlap (an exclusion
 * constraint over the time range, btree_gist from docker/postgres/init),
 * so two requests racing for one slot can't both win. Completed,
 * cancelled and no-show appointments release it.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table appointments (
      id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients on delete restrict,
      inquiry_id uuid references inquiries on delete set null,
      kind text not null check (kind in ('session', 'consultation', 'aftercare')),
      title text not null check (length(title) between 1 and 200),
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'completed', 'cancelled', 'no_show')),
      prep text,
      demo boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint appointments_ends_after_start check (ends_at > starts_at),
      constraint appointments_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
        where (status in ('proposed', 'confirmed'))
    );
    create index appointments_starts on appointments (starts_at);
    create index appointments_client on appointments (client_id);

    -- the studio's weekly opening windows, in its own time zone (studio_settings.timezone)
    create table availability (
      id uuid primary key default gen_random_uuid(),
      weekday smallint not null check (weekday between 0 and 6),
      start_time time not null,
      end_time time not null,
      check (end_time > start_time)
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists availability;
    drop table if exists appointments;
  `.execute(db);
}
