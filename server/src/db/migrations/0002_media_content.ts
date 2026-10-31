import { sql, type Kysely } from 'kysely';

/**
 * The public site's records: media, the portfolio, the journal, canvas
 * calls, testimonials (with consent), and the home page's content with
 * its published versions.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table media_assets (
      id uuid primary key default gen_random_uuid(),
      visibility text not null check (visibility in ('public', 'private')),
      kind text not null check (kind in ('image')),
      mime text not null,
      bytes integer not null check (bytes > 0),
      width integer,
      height integer,
      sha256 text not null,
      storage_key text not null unique,
      variants jsonb not null default '[]',
      alt text,
      focal jsonb,
      origin text,
      created_by uuid references users on delete set null,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    create index media_assets_sha on media_assets (sha256);
    create index media_assets_deleted on media_assets (deleted_at) where deleted_at is not null;

    create table works (
      id uuid primary key default gen_random_uuid(),
      number integer not null unique check (number > 0),
      slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
      title text not null,
      alt text not null,
      image_id uuid not null references media_assets,
      description text,
      subject text[] not null default '{}',
      style text[] not null default '{}',
      composition text[] not null default '{}',
      linework text[] not null default '{}',
      mood text[] not null default '{}',
      placement text,
      colour text,
      tags text[] not null default '{}',
      metadata_status text not null default 'demo' check (metadata_status in ('demo', 'verified')),
      published boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index works_published_order on works (sort_order) where published;

    create table journal_posts (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
      kind text not null check (kind in ('convention', 'guest-spot', 'award', 'studio', 'announcement')),
      title text not null,
      date date not null,
      summary text not null,
      body jsonb not null default '[]',
      image jsonb,
      event jsonb,
      published boolean not null default true,
      demo boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table canvas_calls (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
      title text not null,
      summary text not null,
      description jsonb not null default '[]',
      status text not null check (status in ('upcoming', 'open', 'booked', 'closed')),
      artwork jsonb not null,
      placement text,
      scale text,
      offer text,
      eligibility text[] not null default '{}',
      deadline date,
      event_post_id uuid references journal_posts on delete set null,
      published boolean not null default true,
      demo boolean not null default false,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table journal_post_works (
      post_id uuid not null references journal_posts on delete cascade,
      work_id uuid not null references works on delete cascade,
      primary key (post_id, work_id)
    );
    create table journal_post_calls (
      post_id uuid not null references journal_posts on delete cascade,
      call_id uuid not null references canvas_calls on delete cascade,
      primary key (post_id, call_id)
    );
    create table canvas_call_works (
      call_id uuid not null references canvas_calls on delete cascade,
      work_id uuid not null references works on delete cascade,
      primary key (call_id, work_id)
    );

    -- a client's words: never stored without the record of their consent. Only a
    -- fictional demo entry (demo = true) has none - and it's labelled fictional everywhere.
    create table testimonials (
      id uuid primary key default gen_random_uuid(),
      ext_id text not null unique,
      quote text not null check (length(quote) between 1 and 2000),
      attribution text not null,
      work_id uuid references works on delete set null,
      context text,
      consent_date date,
      consent_via text,
      published boolean not null default false,
      demo boolean not null default false,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint testimonials_consent check (demo or (consent_date is not null and length(coalesce(consent_via, '')) > 0))
    );

    create table content_documents (
      key text primary key,
      draft jsonb not null,
      draft_updated_at timestamptz,
      draft_updated_by uuid references users on delete set null,
      published_version integer
    );
    create table content_versions (
      key text not null references content_documents on delete cascade,
      version integer not null check (version > 0),
      data jsonb not null,
      created_at timestamptz not null default now(),
      created_by uuid references users on delete set null,
      primary key (key, version)
    );
    alter table content_documents
      add constraint content_documents_published_fk foreign key (key, published_version)
      references content_versions (key, version) deferrable initially deferred;
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    alter table if exists content_documents drop constraint if exists content_documents_published_fk;
    drop table if exists content_versions;
    drop table if exists content_documents;
    drop table if exists testimonials;
    drop table if exists canvas_call_works;
    drop table if exists journal_post_calls;
    drop table if exists journal_post_works;
    drop table if exists canvas_calls;
    drop table if exists journal_posts;
    drop table if exists works;
    drop table if exists media_assets;
  `.execute(db);
}
