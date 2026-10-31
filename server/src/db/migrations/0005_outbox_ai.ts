import { sql, type Kysely } from 'kysely';

/** The email queue, and the assistant's usage ledger and proposals. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table email_outbox (
      id uuid primary key default gen_random_uuid(),
      to_address citext not null,
      template text not null,
      subject text not null,
      payload jsonb not null default '{}',
      status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
      attempts integer not null default 0,
      max_attempts integer not null default 5,
      send_after timestamptz not null default now(),
      last_error text,
      sent_at timestamptz,
      related_type text,
      related_id text,
      created_at timestamptz not null default now()
    );
    create index email_outbox_due on email_outbox (send_after) where status = 'pending';

    create table ai_usage (
      id uuid primary key default gen_random_uuid(),
      at timestamptz not null default now(),
      user_id uuid references users on delete set null,
      task text not null,
      model text not null,
      input_tokens integer not null default 0,
      output_tokens integer not null default 0,
      cost_usd numeric(12, 6) not null default 0,
      status text not null check (status in ('ok', 'error', 'blocked')),
      error text
    );
    create index ai_usage_at on ai_usage (at);

    -- what the assistant suggests: nothing happens until the owner approves it
    create table ai_proposals (
      id uuid primary key default gen_random_uuid(),
      task text not null check (task in ('inquiry-summary', 'reply-draft')),
      inquiry_id uuid not null references inquiries on delete cascade,
      content text not null,
      model text,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
      created_by uuid references users on delete set null,
      created_at timestamptz not null default now(),
      decided_by uuid references users on delete set null,
      decided_at timestamptz
    );
    create index ai_proposals_inquiry on ai_proposals (inquiry_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop table if exists ai_proposals;
    drop table if exists ai_usage;
    drop table if exists email_outbox;
  `.execute(db);
}
