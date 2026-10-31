import { sql, type Kysely } from 'kysely';

/** Clients, the inquiries they send, their references, notes and follow-ups. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table clients (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email citext,
      phone text,
      instagram text,
      preferred_contact text check (preferred_contact in ('email', 'phone', 'instagram')),
      -- a fictional sample record: never real client information
      demo boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      archived_at timestamptz,
      anonymized_at timestamptz
    );
    create unique index clients_email_unique on clients (email) where email is not null and anonymized_at is null;

    create table inquiries (
      id uuid primary key default gen_random_uuid(),
      public_ref text not null unique,
      client_id uuid not null references clients on delete restrict,
      status text not null default 'submitted'
        check (status in ('submitted', 'under-review', 'changes-requested', 'accepted', 'declined', 'contacted', 'booking', 'completed')),
      entry jsonb not null,
      summary jsonb not null,
      -- the contact details exactly as submitted with this inquiry
      contact jsonb not null default '{}',
      idempotency_key uuid unique,
      consent_at timestamptz,
      privacy_notice_version text,
      ip_hash text,
      user_agent text,
      spam_score integer not null default 0,
      demo boolean not null default false,
      submitted_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      anonymized_at timestamptz
    );
    create index inquiries_status_submitted on inquiries (status, submitted_at desc);
    create index inquiries_client on inquiries (client_id);
    create index inquiries_submitted on inquiries (submitted_at desc);

    create table inquiry_references (
      id uuid primary key default gen_random_uuid(),
      inquiry_id uuid not null references inquiries on delete cascade,
      kind text not null check (kind in ('work', 'upload', 'external', 'concept')),
      work_number integer,
      media_id uuid references media_assets on delete set null,
      url text,
      note text,
      position integer not null default 0
    );
    create index inquiry_references_inquiry on inquiry_references (inquiry_id);

    create table notes (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients on delete cascade,
      inquiry_id uuid references inquiries on delete cascade,
      body text not null check (length(body) between 1 and 4000),
      author_id uuid references users on delete set null,
      source text not null default 'user' check (source in ('user', 'assistant')),
      created_at timestamptz not null default now(),
      -- a note belongs to exactly one record
      check ((client_id is null) <> (inquiry_id is null))
    );
    create index notes_client on notes (client_id) where client_id is not null;
    create index notes_inquiry on notes (inquiry_id) where inquiry_id is not null;

    create table follow_ups (
      id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients on delete cascade,
      inquiry_id uuid references inquiries on delete set null,
      kind text not null check (kind in ('reply', 'reminder', 'aftercare')),
      reason text not null,
      due_at timestamptz not null,
      done_at timestamptz,
      demo boolean not null default false,
      created_at timestamptz not null default now()
    );
    create index follow_ups_open on follow_ups (due_at) where done_at is null;
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists follow_ups;
    drop table if exists notes;
    drop table if exists inquiry_references;
    drop table if exists inquiries;
    drop table if exists clients;
  `.execute(db);
}
