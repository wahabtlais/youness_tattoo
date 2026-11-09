import { sql, type Kysely } from 'kysely';

/**
 * The client portal, refined:
 *
 *   client_uploads           images a client uploads before they belong to
 *                            anything - the references sent with a first
 *                            consultation request. The row is the proof of
 *                            whose they are until the request is sent (then
 *                            they're the request's references, and the row
 *                            records which request they joined).
 *   client_account_requests  what a client asks of their account that Younes
 *                            reviews - today, closing it (deletion). Nothing
 *                            is deleted automatically: no retention policy
 *                            has been approved yet.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table client_uploads (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references client_accounts on delete cascade,
      media_id uuid not null references media_assets on delete restrict,
      created_at timestamptz not null default now(),
      inquiry_id uuid references inquiries on delete set null,
      attached_at timestamptz
    );
    create index client_uploads_account on client_uploads (account_id, created_at desc);
    create index client_uploads_unattached on client_uploads (created_at) where attached_at is null;

    create table client_account_requests (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references client_accounts on delete restrict,
      kind text not null check (kind in ('deletion')),
      status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
      reason text check (length(reason) <= 2000),
      requested_at timestamptz not null default now(),
      resolved_at timestamptz,
      resolved_by uuid references users on delete set null,
      resolution text check (length(resolution) <= 2000)
    );
    -- one open request of a kind per account
    create unique index client_account_requests_open on client_account_requests (account_id, kind) where status = 'pending';
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists client_account_requests;
    drop table if exists client_uploads;
  `.execute(db);
}
