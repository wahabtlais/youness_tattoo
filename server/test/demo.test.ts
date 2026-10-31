import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { attention, inquirySeries, kpis, pipeline, realRecords, seriesStats, workload } from '../../src/dashboard/analytics.ts';
import { demoOverview } from '../../src/dashboard/data/demoOverview.ts';
import type { Overview } from '../../src/dashboard/types.ts';
import { SERVER_ROOT } from '../src/config.ts';
import { addDemo, assertDemoAllowed, removeDemo } from '../src/db/seed/demo.ts';
import { consultation, makeCtx, ORIGIN, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

// the sample records on a live studio: demo:add / demo:remove (db/seed/demo.ts)
let ctx: Ctx;
let cookie: string;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await resetDb(ctx);
  cookie = (await signIn(ctx)).cookie;
});

// a fixed moment, so the samples' times are known
const NOW = new Date('2031-05-12T08:00:00Z');
const sample = demoOverview(NOW);
const firstSlot = sample.appointments[0];

const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => ctx.app.inject({ method, url, payload, headers: { ...STUDIO, cookie } });
const submit = (body: object) => ctx.app.inject({ method: 'POST', url: '/api/public/consultations', payload: body, headers: { origin: ORIGIN } });
const count = async (table: 'clients' | 'inquiries' | 'appointments' | 'follow_ups' | 'activity_log' | 'works' | 'testimonials', demo?: boolean) => {
  let q = ctx.db.selectFrom(table).select(sql<number>`count(*)::int`.as('n'));
  if (demo !== undefined && table !== 'activity_log' && table !== 'works' && table !== 'testimonials') q = q.where('demo', '=', demo);
  return (await q.executeTakeFirstOrThrow()).n;
};
const realClient = async () => (await ctx.db.insertInto('clients').values({ name: 'Real Client', email: 'real@example.test' }).returning('id').executeTakeFirstOrThrow()).id;
const book = (clientId: string, startsAt: string, endsAt: string) => call('POST', '/api/studio/appointments', { clientId, kind: 'session', title: 'A real session', startsAt, endsAt, status: 'confirmed' });

describe('production safety', () => {
  it('refuses production without --production, and allows it with', () => {
    expect(() => assertDemoAllowed(true, [])).toThrow(/--production/);
    expect(() => assertDemoAllowed(true, ['--production'])).not.toThrow();
    expect(() => assertDemoAllowed(false, [])).not.toThrow();
  });

  it('the CLI on a production config writes nothing without --production', async () => {
    const run = promisify(execFile);
    const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: process.env.TEST_DATABASE_URL, MIGRATION_DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL };
    const args = ['--import', 'tsx', '--import', './src/db/seed/register-assets.mjs', path.join('src', 'cli.ts')];
    for (const command of ['demo:add', 'demo:remove']) {
      const r = await run(process.execPath, [...args, command], { cwd: SERVER_ROOT, env }).then(
        () => ({ failed: false, stderr: '' }),
        (e: { stderr: string }) => ({ failed: true, stderr: e.stderr }),
      );
      expect(r.failed).toBe(true);
      expect(r.stderr).toMatch(/--production/);
    }
    expect(await count('inquiries')).toBe(0);
    // and with it, the same command adds the samples (and only them)
    const ok = await run(process.execPath, [...args, 'demo:add', '--production'], { cwd: SERVER_ROOT, env });
    expect(ok.stdout).toMatch(/sample inquiries/);
    expect(await count('inquiries', true)).toBe(sample.inquiries.length);
  }, 60_000);
});

describe('demo:add', () => {
  it('adds only flagged sample rows: no content import, no history', async () => {
    const before = { works: await count('works'), testimonials: await count('testimonials'), log: await count('activity_log') };
    const r = await addDemo(ctx.db, { now: NOW });
    expect(r).toMatchObject({ added: true, inquiries: sample.inquiries.length, appointments: sample.appointments.length, followUps: sample.followUps.length, activity: 0, skipped: [] });
    for (const t of ['clients', 'inquiries', 'appointments', 'follow_ups'] as const) expect(await count(t, false)).toBe(0);
    expect(await count('inquiries', true)).toBe(sample.inquiries.length);
    expect(await count('works')).toBe(before.works);
    expect(await count('testimonials')).toBe(before.testimonials);
    expect(await count('activity_log')).toBe(before.log);
    // no contact details: nothing can be sent, and no consultation can join one
    expect(await ctx.db.selectFrom('clients').select('id').where('demo', '=', true).where('email', 'is not', null).execute()).toHaveLength(0);
  });

  it('is safe to run again: the second run adds nothing', async () => {
    await addDemo(ctx.db, { now: NOW });
    const again = await addDemo(ctx.db, { now: NOW });
    expect(again.added).toBe(false);
    expect(await count('inquiries')).toBe(sample.inquiries.length);
    expect(await count('appointments')).toBe(sample.appointments.length);
  });

  it('leaves out a sample appointment whose time a real one holds - and only that one', async () => {
    const real = await book(await realClient(), firstSlot.startsAt, firstSlot.endsAt);
    expect(real.statusCode).toBe(201);
    const r = await addDemo(ctx.db, { now: NOW });
    expect(r.skipped).toEqual([{ title: firstSlot.title, startsAt: firstSlot.startsAt }]);
    expect(r.appointments).toBe(sample.appointments.length - 1);
    const kept = await ctx.db.selectFrom('appointments').select(['status', 'demo']).where('id', '=', real.json().id).executeTakeFirstOrThrow();
    expect(kept).toEqual({ status: 'confirmed', demo: false });
  });
});

describe('sample appointments never block a real one', () => {
  beforeEach(() => addDemo(ctx.db, { now: NOW }));
  const demoAt = (startsAt: string) => ctx.db.selectFrom('appointments').select(['status', 'demo']).where('demo', '=', true).where('starts_at', '=', new Date(startsAt)).executeTakeFirstOrThrow();

  it('booking over a sample cancels the sample, with no history entry for it', async () => {
    const before = await count('activity_log');
    const r = await book(await realClient(), firstSlot.startsAt, firstSlot.endsAt);
    expect(r.statusCode).toBe(201);
    expect(await demoAt(firstSlot.startsAt)).toEqual({ status: 'cancelled', demo: true });
    const log = await ctx.db.selectFrom('activity_log').select('action').orderBy('id').offset(before).execute();
    expect(log.map((l) => l.action)).toEqual(['appointment.created']);
  });

  it('moving a real appointment onto a sample works the same way', async () => {
    const client = await realClient();
    const r = await book(client, '2031-06-01T10:00:00Z', '2031-06-01T11:00:00Z');
    const move = await call('PATCH', `/api/studio/appointments/${r.json().id}`, { startsAt: firstSlot.startsAt, endsAt: firstSlot.endsAt });
    expect(move.statusCode).toBe(200);
    expect(await demoAt(firstSlot.startsAt)).toEqual({ status: 'cancelled', demo: true });
  });

  it('a real appointment still refuses another real one', async () => {
    const client = await realClient();
    expect((await book(client, '2031-06-02T10:00:00Z', '2031-06-02T12:00:00Z')).statusCode).toBe(201);
    expect((await book(client, '2031-06-02T11:00:00Z', '2031-06-02T13:00:00Z')).statusCode).toBe(409);
  });
});

describe('demo:remove', () => {
  it('removes every sample row, keeps every real one, writes no history - and is safe to run again', async () => {
    expect((await submit(consultation())).statusCode).toBe(201);
    const real = await realClient();
    await book(real, '2031-06-03T10:00:00Z', '2031-06-03T11:00:00Z');
    await addDemo(ctx.db, { now: NOW });
    const realBefore = { clients: await count('clients', false), inquiries: await count('inquiries', false), appointments: await count('appointments', false) };
    const log = await count('activity_log');

    const r = await removeDemo(ctx.db);
    expect(r).toMatchObject({ inquiries: sample.inquiries.length, appointments: sample.appointments.length, followUps: sample.followUps.length, kept: [] });
    for (const t of ['clients', 'inquiries', 'appointments', 'follow_ups'] as const) expect(await count(t, true)).toBe(0);
    expect({ clients: await count('clients', false), inquiries: await count('inquiries', false), appointments: await count('appointments', false) }).toEqual(realBefore);
    expect(await count('activity_log')).toBe(log);

    expect(await removeDemo(ctx.db)).toEqual({ clients: 0, inquiries: 0, appointments: 0, followUps: 0, notes: 0, kept: [] });
    // and the samples can come back
    expect((await addDemo(ctx.db, { now: NOW })).added).toBe(true);
  });

  it('keeps a sample client that real records belong to, and everything of theirs', async () => {
    const added = await addDemo(ctx.db, { now: NOW });
    const [a, b, c] = await ctx.db.selectFrom('clients').select(['id', 'name']).where('demo', '=', true).orderBy('name').limit(3).execute();
    // a: a real consultation joined it (the studio had given it an email)
    await ctx.db.updateTable('clients').set({ email: 'became-real@example.test' }).where('id', '=', a.id).execute();
    expect((await submit(consultation({ contact: { name: 'Became Real', email: 'became-real@example.test' } }))).statusCode).toBe(201);
    // b: the studio booked a real appointment for it
    expect((await book(b.id, '2031-06-04T10:00:00Z', '2031-06-04T11:00:00Z')).statusCode).toBe(201);
    // c: a real follow-up
    await ctx.db.insertInto('follow_ups').values({ client_id: c.id, kind: 'reply', reason: 'A real promise', due_at: new Date('2031-06-05T10:00:00Z') }).execute();
    const own = async (id: string) => ({
      inquiries: (await ctx.db.selectFrom('inquiries').select('id').where('client_id', '=', id).execute()).length,
      appointments: (await ctx.db.selectFrom('appointments').select('id').where('client_id', '=', id).execute()).length,
      followUps: (await ctx.db.selectFrom('follow_ups').select('id').where('client_id', '=', id).execute()).length,
    });
    const before = { a: await own(a.id), b: await own(b.id), c: await own(c.id) };

    const r = await removeDemo(ctx.db);
    expect(r.kept.map((k) => k.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(r.clients).toBe(added.clients - 3);
    expect({ a: await own(a.id), b: await own(b.id), c: await own(c.id) }).toEqual(before);
    expect(await count('inquiries', false)).toBe(1);
    expect(await count('appointments', false)).toBe(1);
    // run again: the kept ones stay kept, nothing else to do
    expect(await removeDemo(ctx.db)).toMatchObject({ clients: 0, inquiries: 0, kept: r.kept });
  });

  it('keeps a sample inquiry that a real appointment points at (with its client)', async () => {
    await addDemo(ctx.db, { now: NOW });
    const q = await ctx.db.selectFrom('inquiries').select(['id', 'client_id']).where('demo', '=', true).orderBy('public_ref').executeTakeFirstOrThrow();
    const real = await realClient();
    await ctx.db.insertInto('appointments').values({ client_id: real, inquiry_id: q.id, kind: 'session', title: 'Real, about a sample', starts_at: new Date('2031-06-06T10:00:00Z'), ends_at: new Date('2031-06-06T11:00:00Z'), status: 'confirmed' }).execute();
    const r = await removeDemo(ctx.db);
    expect(r.kept.map((k) => k.id)).toEqual([q.client_id]);
    expect(await ctx.db.selectFrom('inquiries').select('id').where('id', '=', q.id).executeTakeFirst()).toBeTruthy();
    expect((await ctx.db.selectFrom('appointments').select('inquiry_id').where('demo', '=', false).executeTakeFirstOrThrow()).inquiry_id).toBe(q.id);
  });
});

describe('the dashboard’s figures leave the samples out', () => {
  it('counts only the real inquiry and appointment, while the work lists still show the samples', async () => {
    // samples dated around today, beside one real inquiry and one real appointment this week
    const now = new Date();
    await addDemo(ctx.db, { now });
    expect((await submit(consultation())).statusCode).toBe(201);
    const real = await realClient();
    const at = new Date(now.getTime() + 2 * 86_400_000);
    at.setHours(8, 0, 0, 0);
    expect((await book(real, at.toISOString(), new Date(at.getTime() + 3_600_000).toISOString())).statusCode).toBe(201);

    const o = (await call('GET', '/api/studio/overview')).json() as Overview;
    expect(o.demo).toBe(true);
    expect(o.inquiries.length).toBe(sample.inquiries.length + 1);

    const live = realRecords(o);
    const k = kpis(live, now);
    expect(k).toMatchObject({ received: 1, newInquiries: 1, booked: 0, conversion: 0, followUps: 0, upcoming: 1 });
    expect(k.upcomingHours).toBe(1);
    expect(pipeline(live).total).toBe(1);
    expect(seriesStats(inquirySeries(live, now, 'weeks')).total).toBe(1);
    expect(workload(live, now).flatMap((d) => d.appointments).every((a) => !a.demo)).toBe(true);
    // with the samples, the same figures would be far off - that's what's kept out
    expect(kpis(o, now).received).toBeGreaterThan(1);
    // what needs attention still lists samples, each labelled
    const items = attention(o, now);
    expect(items.some((i) => i.demo)).toBe(true);
    expect(attention(live, now).every((i) => !i.demo)).toBe(true);
  });
});
