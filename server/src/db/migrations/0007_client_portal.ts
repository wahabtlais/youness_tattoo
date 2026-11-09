import { sql, type Kysely } from 'kysely';

/**
 * The client portal: client accounts (entirely separate from the studio's
 * users - their own table, sessions and tokens, so no client credential
 * can ever stand for a studio user), their projects, the messages between
 * client and studio, and aftercare - the guides Younes writes and
 * approves, the plan given to a finished piece, and the healing photos a
 * client sends back.
 *
 * Ownership: every client-facing row hangs off `clients.id`, and the
 * account is linked to its client record only once its email is verified -
 * so the API can scope every query to one client, and registering with
 * someone else's address never exposes their history.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    -- ---------------- accounts ----------------
    create table client_accounts (
      id uuid primary key default gen_random_uuid(),
      email citext not null unique,
      name text not null check (length(name) between 1 and 120),
      password_hash text not null,
      -- null until the email is verified: no access to anything before it
      email_verified_at timestamptz,
      -- set at verification (one account per client record)
      client_id uuid unique references clients on delete set null,
      password_changed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      disabled_at timestamptz
    );

    create table client_sessions (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references client_accounts on delete cascade,
      token_hash bytea not null unique,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      idle_expires_at timestamptz not null,
      absolute_expires_at timestamptz not null,
      revoked_at timestamptz,
      user_agent text
    );
    create index client_sessions_account_active on client_sessions (account_id) where revoked_at is null;

    -- one-time links: verifying an email, resetting a password
    create table client_tokens (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references client_accounts on delete cascade,
      purpose text not null check (purpose in ('verify-email', 'reset-password')),
      token_hash bytea not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index client_tokens_account on client_tokens (account_id, purpose) where used_at is null;

    -- ---------------- requests ----------------
    -- a request from the portal is an inquiry like any other (the studio's
    -- pipeline handles both): who sent it, and whether it asks for a
    -- consultation or for a session to be booked on a project
    alter table inquiries
      add column kind text not null default 'consultation' check (kind in ('consultation', 'booking')),
      add column account_id uuid references client_accounts on delete set null;
    create index inquiries_account on inquiries (account_id) where account_id is not null;

    -- ---------------- projects ----------------
    create table projects (
      id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients on delete restrict,
      -- the request it grew from, if any (one project per request)
      inquiry_id uuid unique references inquiries on delete set null,
      title text not null check (length(title) between 1 and 160),
      concept text,
      description text,
      placement text,
      size text,
      status text not null default 'design'
        check (status in ('design', 'ready-to-book', 'scheduled', 'in-progress', 'healing', 'complete', 'on-hold')),
      demo boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index projects_client on projects (client_id);

    alter table inquiries add column project_id uuid references projects on delete set null;
    alter table appointments add column project_id uuid references projects on delete set null;
    create index appointments_project on appointments (project_id) where project_id is not null;

    -- images on a project: the client's references, the studio's designs
    create table project_media (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references projects on delete cascade,
      media_id uuid not null references media_assets on delete restrict,
      kind text not null check (kind in ('reference', 'design')),
      added_by text not null check (added_by in ('client', 'studio')),
      caption text check (length(caption) <= 300),
      created_at timestamptz not null default now()
    );
    create index project_media_project on project_media (project_id);

    -- the conversation the client sees: on a request, or on a project
    create table client_messages (
      id uuid primary key default gen_random_uuid(),
      client_id uuid not null references clients on delete cascade,
      inquiry_id uuid references inquiries on delete cascade,
      project_id uuid references projects on delete cascade,
      author text not null check (author in ('client', 'studio')),
      author_user_id uuid references users on delete set null,
      body text not null check (length(body) between 1 and 4000),
      created_at timestamptz not null default now(),
      read_by_client_at timestamptz,
      read_by_studio_at timestamptz,
      check ((inquiry_id is null) <> (project_id is null))
    );
    create index client_messages_inquiry on client_messages (inquiry_id, created_at) where inquiry_id is not null;
    create index client_messages_project on client_messages (project_id, created_at) where project_id is not null;
    create index client_messages_unread_studio on client_messages (created_at) where author = 'client' and read_by_studio_at is null;

    -- ---------------- aftercare ----------------
    -- written by Younes; a guide reaches a client only once he has approved it
    create table aftercare_guides (
      id uuid primary key default gen_random_uuid(),
      title text not null check (length(title) between 1 and 160),
      intro text,
      approved_at timestamptz,
      approved_by uuid references users on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table aftercare_steps (
      id uuid primary key default gen_random_uuid(),
      guide_id uuid not null references aftercare_guides on delete cascade,
      -- the healing days it covers: day 0 is the session's day
      day_from integer not null check (day_from between 0 and 365),
      day_to integer check (day_to is null or day_to >= day_from),
      title text not null check (length(title) between 1 and 160),
      body text not null check (length(body) between 1 and 6000),
      position integer not null default 0
    );
    create index aftercare_steps_guide on aftercare_steps (guide_id, position);

    -- a guide given to a finished piece: a copy of the approved text as it
    -- was given (later edits to the guide don't change what a healing client reads)
    create table aftercare_plans (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null unique references projects on delete cascade,
      guide_id uuid references aftercare_guides on delete set null,
      title text not null,
      intro text,
      steps jsonb not null,
      -- the session's day: day 0 of healing
      started_on date not null,
      reminders boolean not null default true,
      assigned_by uuid references users on delete set null,
      assigned_at timestamptz not null default now()
    );

    create table healing_photos (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references projects on delete cascade,
      media_id uuid not null references media_assets on delete restrict,
      note text check (length(note) <= 1000),
      submitted_at timestamptz not null default now(),
      response text check (length(response) <= 4000),
      responded_at timestamptz,
      responded_by uuid references users on delete set null
    );
    create index healing_photos_project on healing_photos (project_id, submitted_at desc);
    create index healing_photos_unanswered on healing_photos (submitted_at) where responded_at is null;
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists healing_photos;
    drop table if exists aftercare_plans;
    drop table if exists aftercare_steps;
    drop table if exists aftercare_guides;
    drop table if exists client_messages;
    drop table if exists project_media;
    alter table appointments drop column if exists project_id;
    alter table inquiries drop column if exists project_id;
    drop table if exists projects;
    alter table inquiries drop column if exists account_id;
    alter table inquiries drop column if exists kind;
    drop table if exists client_tokens;
    drop table if exists client_sessions;
    drop table if exists client_accounts;
  `.execute(db);
}
