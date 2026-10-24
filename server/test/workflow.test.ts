import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyRetention } from '../src/modules/inquiries/service.ts';
import { consultation, makeCtx, ORIGIN, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

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

const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  ctx.app.inject({ method, url, payload, headers: { ...STUDIO, cookie } });

async function newInquiry(over: Record<string, unknown> = {}) {
  await ctx.app.inject({ method: 'POST', url: '/api/public/consultations', payload: consultation(over), headers: { origin: ORIGIN } });
  const overview = (await call('GET', '/api/studio/overview')).json();
  return overview.inquiries[0] as { id: string; clientId: string };
}

describe('inquiry workflow', () => {
  it('status changes are stored and recorded in the history (with names looked up, not stored)', async () => {
    const q = await newInquiry();
    const r = await call('PATCH', `/api/studio/inquiries/${q.id}/status`, { status: 'under-review', note: 'Looks promising' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ changed: true });
    expect((await call('PATCH', `/api/studio/inquiries/${q.id}/status`, { status: 'under-review' })).json()).toEqual({ changed: false });
    expect((await call('PATCH', `/api/studio/inquiries/${q.id}/status`, { status: 'nonsense' })).statusCode).toBe(400);
    const detail = (await call('GET', `/api/studio/inquiries/${q.id}`)).json();
    expect(detail.status).toBe('under-review');
    expect(detail.notes[0].body).toBe('Looks promising');
    const activity = (await call('GET', '/api/studio/activity')).json();
    expect(activity.map((a: { text: string }) => a.text)).toContain('Moved Test Client to In review');
  });

  it('notes and follow-ups attach to the client, and complete', async () => {
    const q = await newInquiry();
    expect((await call('POST', `/api/studio/clients/${q.clientId}/notes`, { body: 'Prefers weekday mornings' })).statusCode).toBe(201);
    expect((await call('POST', `/api/studio/clients/${q.clientId}/notes`, { body: '' })).statusCode).toBe(400);
    const due = new Date(Date.now() + 86_400_000).toISOString();
    const f = await call('POST', '/api/studio/follow-ups', { clientId: q.clientId, inquiryId: q.id, kind: 'reply', reason: 'Send sizing questions', dueAt: due });
    expect(f.statusCode).toBe(201);
    let overview = (await call('GET', '/api/studio/overview')).json();
    expect(overview.followUps).toHaveLength(1);
    expect((await call('PATCH', `/api/studio/follow-ups/${f.json().id}`, { done: true })).statusCode).toBe(200);
    overview = (await call('GET', '/api/studio/overview')).json();
    expect(overview.followUps).toHaveLength(0);
    const client = (await call('GET', `/api/studio/clients/${q.clientId}`)).json();
    expect(client.notes[0].body).toBe('Prefers weekday mornings');
    expect(client.followUps[0].doneAt).toBeTruthy();
  });

  it('client details can be corrected, never through a public route', async () => {
    const q = await newInquiry();
    expect((await call('PATCH', `/api/studio/clients/${q.clientId}`, { phone: '+1 313 555 0111', preferredContact: 'phone' })).statusCode).toBe(200);
    const c = (await call('GET', `/api/studio/clients/${q.clientId}`)).json();
    expect(c).toMatchObject({ phone: '+1 313 555 0111', preferredContact: 'phone' });
    const log = await ctx.db.selectFrom('activity_log').select('data').where('action', '=', 'client.updated').executeTakeFirstOrThrow();
    expect(JSON.stringify(log.data)).not.toContain('555');
  });

  it('settings: a real time zone only, and budgets in range', async () => {
    expect((await call('PATCH', '/api/studio/settings', { timezone: 'Mars/Olympus' })).statusCode).toBe(400);
    const ok = await call('PATCH', '/api/studio/settings', { timezone: 'America/Detroit', retentionMonths: 36, notifyEmail: 'studio@example.test' });
    expect(ok.json()).toMatchObject({ timezone: 'America/Detroit', retentionMonths: 36, notifyEmail: 'studio@example.test' });
    expect((await call('PATCH', '/api/studio/settings', { retentionMonths: 0 })).statusCode).toBe(400);
  });
});

describe('retention', () => {
  it('anonymises a client whose inquiries are all closed and old, and only them', async () => {
    const closed = await newInquiry({ contact: { name: 'Old Client', email: 'old@example.test' } });
    const open = await newInquiry({ contact: { name: 'Current Client', email: 'current@example.test' } });
    await ctx.db.updateTable('inquiries').set({ status: 'declined' }).where('id', '=', closed.id).execute();
    const old = new Date(Date.now() - 30 * 31 * 86_400_000);
    await ctx.db.updateTable('inquiries').set({ updated_at: old }).execute();
    await ctx.db.updateTable('clients').set({ updated_at: old }).execute();
    expect(await applyRetention(ctx.db)).toBe(1);
    const gone = await ctx.db.selectFrom('clients').selectAll().where('id', '=', closed.clientId).executeTakeFirstOrThrow();
    expect(gone).toMatchObject({ name: 'Anonymised client', email: null, phone: null, instagram: null });
    const kept = await ctx.db.selectFrom('clients').selectAll().where('id', '=', open.clientId).executeTakeFirstOrThrow();
    expect(kept.email).toBe('current@example.test');
    const q = await ctx.db.selectFrom('inquiries').select(['contact', 'summary']).where('id', '=', closed.id).executeTakeFirstOrThrow();
    expect(JSON.stringify(q)).not.toMatch(/old@example|lion/);
  });
});
