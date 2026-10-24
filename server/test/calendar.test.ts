import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeCtx, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

let ctx: Ctx;
let cookie: string;
let clientId: string;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await resetDb(ctx);
  cookie = (await signIn(ctx)).cookie;
  clientId = (await ctx.db.insertInto('clients').values({ name: 'Calendar Client', email: 'cal@example.test' }).returning('id').executeTakeFirstOrThrow()).id;
});

const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, payload?: object) => ctx.app.inject({ method, url, payload, headers: { ...STUDIO, cookie } });
// 2027-03-10 11:00 in Detroit (EST, -05:00) and the same wall-clock hour after the DST change (EDT, -04:00)
const appt = (startsAt: string, endsAt: string, status = 'proposed') => ({ clientId, kind: 'session', title: 'Session 1', startsAt, endsAt, status });

describe('appointments', () => {
  it('stores instants: 11:00 Detroit time is the right UTC moment either side of daylight saving', async () => {
    const winter = await call('POST', '/api/studio/appointments', appt('2027-03-10T11:00:00-05:00', '2027-03-10T13:00:00-05:00'));
    const summer = await call('POST', '/api/studio/appointments', appt('2027-03-17T11:00:00-04:00', '2027-03-17T13:00:00-04:00'));
    expect([winter.statusCode, summer.statusCode]).toEqual([201, 201]);
    const list = (await call('GET', '/api/studio/appointments?from=2027-03-01T00:00:00Z&to=2027-04-01T00:00:00Z')).json();
    expect(list.map((a: { startsAt: string }) => a.startsAt)).toEqual(['2027-03-10T16:00:00.000Z', '2027-03-17T15:00:00.000Z']);
  });

  it('refuses an overlap with a proposed or confirmed appointment (409), allows touching ends', async () => {
    await call('POST', '/api/studio/appointments', appt('2027-05-01T10:00:00Z', '2027-05-01T12:00:00Z', 'confirmed'));
    const clash = await call('POST', '/api/studio/appointments', appt('2027-05-01T11:00:00Z', '2027-05-01T13:00:00Z'));
    expect(clash.statusCode).toBe(409);
    expect(clash.json().code).toBe('slot_taken');
    const after = await call('POST', '/api/studio/appointments', appt('2027-05-01T12:00:00Z', '2027-05-01T13:00:00Z'));
    expect(after.statusCode).toBe(201);
  });

  it('a cancelled appointment releases its time', async () => {
    const first = await call('POST', '/api/studio/appointments', appt('2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'));
    expect((await call('POST', '/api/studio/appointments', appt('2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'))).statusCode).toBe(409);
    await call('PATCH', `/api/studio/appointments/${first.json().id}`, { status: 'cancelled' });
    expect((await call('POST', '/api/studio/appointments', appt('2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'))).statusCode).toBe(201);
  });

  it('moving an appointment onto another is refused too', async () => {
    await call('POST', '/api/studio/appointments', appt('2027-07-01T10:00:00Z', '2027-07-01T12:00:00Z'));
    const b = await call('POST', '/api/studio/appointments', appt('2027-07-01T14:00:00Z', '2027-07-01T15:00:00Z'));
    const move = await call('PATCH', `/api/studio/appointments/${b.json().id}`, { startsAt: '2027-07-01T11:00:00Z', endsAt: '2027-07-01T12:30:00Z' });
    expect(move.statusCode).toBe(409);
  });

  it('ten simultaneous requests for one slot: exactly one wins (Postgres decides)', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/api/studio/appointments', appt('2027-08-01T10:00:00Z', '2027-08-01T11:00:00Z'))));
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(9);
  });

  it('simultaneous requests for different but overlapping times: at most one of any overlapping pair is stored', async () => {
    // eight staggered half-hour-apart, two-hour requests at once: every neighbour overlaps the next
    const starts = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2027, 8, 1, 9) + i * 30 * 60_000));
    const results = await Promise.all(starts.map((st) => call('POST', '/api/studio/appointments', appt(st.toISOString(), new Date(st.getTime() + 2 * 3600_000).toISOString()))));
    expect(results.every((r) => r.statusCode === 201 || r.statusCode === 409)).toBe(true);
    const stored = (await call('GET', '/api/studio/appointments?from=2027-09-01T00:00:00Z&to=2027-09-02T00:00:00Z')).json() as { startsAt: string; endsAt: string }[];
    expect(stored.length).toBeGreaterThan(0);
    for (const a of stored) for (const b of stored) if (a !== b) expect(a.endsAt <= b.startsAt || b.endsAt <= a.startsAt).toBe(true);
  });

  it('creating, confirming and cancelling are each recorded in the history', async () => {
    const id = (await call('POST', '/api/studio/appointments', appt('2027-10-01T10:00:00Z', '2027-10-01T11:00:00Z'))).json().id;
    await call('PATCH', `/api/studio/appointments/${id}`, { status: 'confirmed' });
    await call('PATCH', `/api/studio/appointments/${id}`, { status: 'cancelled' });
    const log = await ctx.db.selectFrom('activity_log').select(['action', 'data']).where('action', 'like', 'appointment.%').orderBy('at').execute();
    expect(log.map((l) => [l.action, (l.data as { status?: string }).status])).toEqual([
      ['appointment.created', 'proposed'],
      ['appointment.updated', 'confirmed'],
      ['appointment.updated', 'cancelled'],
    ]);
  });

  it('validates times and links', async () => {
    expect((await call('POST', '/api/studio/appointments', appt('2027-09-01T12:00:00Z', '2027-09-01T11:00:00Z'))).statusCode).toBe(400);
    expect((await call('POST', '/api/studio/appointments', { ...appt('2027-09-01T10:00:00Z', '2027-09-01T11:00:00Z'), clientId: crypto.randomUUID() })).statusCode).toBe(404);
    expect((await call('POST', '/api/studio/appointments', appt('not a date', '2027-09-01T11:00:00Z'))).statusCode).toBe(400);
  });

  it('opening hours are saved and validated', async () => {
    expect((await call('PUT', '/api/studio/availability', { windows: [{ weekday: 2, start: '10:00', end: '18:00' }] })).statusCode).toBe(200);
    expect((await call('GET', '/api/studio/availability')).json().windows).toEqual([{ weekday: 2, start: '10:00', end: '18:00' }]);
    expect((await call('PUT', '/api/studio/availability', { windows: [{ weekday: 2, start: '18:00', end: '10:00' }] })).statusCode).toBe(400);
  });
});
