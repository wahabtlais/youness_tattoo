import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateToLatest, migrateToZero, MIGRATIONS } from '../src/db/migrate.ts';
import { makeCtx, resetDb, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(() => resetDb(ctx));

describe('migrations', () => {
  it('go down to nothing and back up again (every down works)', async () => {
    await migrateToZero(ctx.admin, true);
    const empty = await sql<{ n: number }>`select count(*)::int as n from pg_tables where schemaname = 'public' and tablename not like 'kysely_%'`.execute(ctx.admin);
    expect(empty.rows[0].n).toBe(0);
    await migrateToLatest(ctx.admin, true);
    const applied = await sql<{ n: number }>`select count(*)::int as n from kysely_migration`.execute(ctx.admin);
    expect(applied.rows[0].n).toBe(Object.keys(MIGRATIONS).length);
    await sql`insert into studio_settings default values on conflict do nothing`.execute(ctx.admin);
  });

  it('every table the code knows exists in the database', async () => {
    const tables = (await sql<{ tablename: string }>`select tablename from pg_tables where schemaname = 'public'`.execute(ctx.admin)).rows.map((r) => r.tablename);
    for (const t of ['users', 'sessions', 'trusted_devices', 'password_resets', 'recovery_codes', 'auth_attempts', 'studio_settings', 'activity_log', 'media_assets', 'works', 'journal_posts', 'journal_post_works', 'journal_post_calls', 'canvas_calls', 'canvas_call_works', 'testimonials', 'content_documents', 'content_versions', 'clients', 'inquiries', 'inquiry_references', 'notes', 'follow_ups', 'appointments', 'availability', 'email_outbox', 'ai_usage', 'ai_proposals']) {
      expect(tables, t).toContain(t);
    }
  });
});

describe('least privilege', () => {
  it('the app role can read and write data but not change the schema', async () => {
    await expect(sql`create table intruder (id int)`.execute(ctx.db)).rejects.toThrow(/permission denied/);
    await expect(sql`drop table clients`.execute(ctx.db)).rejects.toThrow(/must be owner|permission denied/);
    await expect(sql`alter table clients add column x int`.execute(ctx.db)).rejects.toThrow(/must be owner|permission denied/);
  });

  it('the history is append-only: no update or delete, even for its owner', async () => {
    await ctx.db.insertInto('activity_log').values({ actor_type: 'system', action: 'test', data: '{}' }).execute();
    await expect(sql`update activity_log set action = 'x'`.execute(ctx.db)).rejects.toThrow(/permission denied/);
    await expect(sql`delete from activity_log`.execute(ctx.db)).rejects.toThrow(/permission denied/);
    await expect(sql`update activity_log set action = 'x'`.execute(ctx.admin)).rejects.toThrow(/append-only/);
  });
});

describe('constraints', () => {
  it('allows only one owner', async () => {
    await ctx.db.insertInto('users').values({ email: 'a@x.test', name: 'A', password_hash: 'h', role: 'owner' }).execute();
    await expect(ctx.db.insertInto('users').values({ email: 'b@x.test', name: 'B', password_hash: 'h', role: 'owner' }).execute()).rejects.toThrow(/users_single_owner/);
  });

  it('refuses a real testimonial without consent, allows a demo one', async () => {
    await expect(ctx.db.insertInto('testimonials').values({ ext_id: 't1', quote: 'q', attribution: 'A', demo: false }).execute()).rejects.toThrow(/testimonials_consent/);
    await ctx.db.insertInto('testimonials').values({ ext_id: 't2', quote: 'q', attribution: 'A', demo: true }).execute();
    await ctx.db.insertInto('testimonials').values({ ext_id: 't3', quote: 'q', attribution: 'A', consent_date: '2026-01-02', consent_via: 'Email' }).execute();
  });

  it('a note belongs to exactly one record', async () => {
    const c = await ctx.db.insertInto('clients').values({ name: 'C' }).returning('id').executeTakeFirstOrThrow();
    await expect(ctx.db.insertInto('notes').values({ body: 'x' }).execute()).rejects.toThrow(/check/);
    await ctx.db.insertInto('notes').values({ body: 'x', client_id: c.id }).execute();
  });
});
