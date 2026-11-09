import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupMedia } from '../src/modules/media/service.ts';
import { consultation, cookieOf, makeCtx, ORIGIN, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

/**
 * The client portal's refinement pass: earlier inquiries joining an
 * account only when ownership is certain, reference images sent with a
 * first request, answering a proposed time, Detroit time throughout, the
 * client's own data (review, export, closing), and the security checks
 * around them.
 */

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(() => resetDb(ctx));

const CLIENT = { origin: ORIGIN, 'x-requested-with': 'younes-client' };
const COOKIE = '__Host-younes-client';
const PASSWORD = 'a long client password 1';

const post = (url: string, payload: unknown, cookie?: string, c = ctx) => c.app.inject({ method: 'POST', url, headers: { ...CLIENT, ...(cookie ? { cookie } : {}) }, payload: payload as never });
const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const studio = (method: string, url: string, cookie: string, payload?: unknown) => ctx.app.inject({ method: method as 'GET', url, headers: { ...STUDIO, cookie }, payload: payload as never });

async function tokenFor(email: string, template: string) {
  const m = await ctx.db.selectFrom('email_outbox').select('payload').where('to_address', '=', email).where('template', '=', template).orderBy('created_at', 'desc').executeTakeFirstOrThrow();
  return new URL(String((m.payload as { link: string }).link)).searchParams.get('token')!;
}
async function register(email: string, name = 'Client') {
  expect((await post('/api/client/register', { name, email, password: PASSWORD, consent: true })).statusCode).toBe(202);
}
async function verify(email: string) {
  const r = await post('/api/client/verify', { token: await tokenFor(email.trim().toLowerCase(), 'client-verify-email') });
  expect(r.statusCode).toBe(200);
  return cookieOf(r, COOKIE)!;
}
const client = async (email: string, name?: string) => {
  await register(email, name);
  return verify(email);
};
const consultationRequest = (over: Record<string, unknown> = {}) => ({
  kind: 'consultation',
  idempotencyKey: crypto.randomUUID(),
  entry: { from: 'hero' },
  summary: { concept: 'A heron' },
  consent: true,
  privacyNoticeVersion: '2026-10-draft',
  ...over,
});
function multipart(file: Buffer) {
  const b = '----younes-refine-boundary';
  const payload = Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="r.png"\r\nContent-Type: image/png\r\n\r\n`), file, Buffer.from(`\r\n--${b}--\r\n`)]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}
const png = (c = '#7a2030') => sharp({ create: { width: 600, height: 400, channels: 3, background: c } }).png().toBuffer();
const upload = async (cookie: string, file?: Buffer) => {
  const m = multipart(file ?? (await png()));
  return ctx.app.inject({ method: 'POST', url: '/api/client/uploads', headers: { ...CLIENT, cookie, ...m.headers }, payload: m.payload });
};
const audit = (action: string) => ctx.db.selectFrom('activity_log').select(['data', 'subject_id']).where('action', '=', action).execute();

describe('an earlier inquiry joins an account only when its ownership is certain', () => {
  it('normalises the address the same way everywhere, and links only after verification', async () => {
    const sent = await ctx.app.inject({ method: 'POST', url: '/api/public/consultations', headers: { origin: ORIGIN }, payload: consultation({ contact: { name: 'Web Person', email: 'Web.Person@Example.test' } }) });
    expect(sent.statusCode).toBe(201);
    await register('  WEB.person@EXAMPLE.test ', 'Web Person');
    // registered, not yet verified: nothing is linked, nothing can be read
    const acct = await ctx.db.selectFrom('client_accounts').select(['email', 'client_id']).executeTakeFirstOrThrow();
    expect(acct).toEqual({ email: 'web.person@example.test', client_id: null });
    expect((await post('/api/client/login', { email: 'web.person@example.test', password: PASSWORD })).statusCode).toBe(403);
    const cookie = await verify('web.person@example.test');
    const requests = (await get('/api/client/requests', cookie)).json();
    expect(requests.map((r: { ref: string }) => r.ref)).toEqual([sent.json().receiptId]);
    const inquiry = await ctx.db.selectFrom('inquiries').select('account_id').executeTakeFirstOrThrow();
    expect(inquiry.account_id).toBeTruthy();
    const linked = await audit('client_account.linked');
    expect(linked).toHaveLength(1);
    expect(linked[0].data).toMatchObject({ inquiries: 1 });
  });

  it('never moves an inquiry that was sent from another account', async () => {
    const other = await client('other@example.test');
    void other;
    const otherAccount = await ctx.db.selectFrom('client_accounts').select('id').where('email', '=', 'other@example.test').executeTakeFirstOrThrow();
    // a record with this email whose inquiry belongs to another account: ownership is in doubt
    const rec = await ctx.db.insertInto('clients').values({ name: 'X', email: 'x@example.test' }).returning('id').executeTakeFirstOrThrow();
    await ctx.db
      .insertInto('inquiries')
      .values({ public_ref: 'YT-AMBIGUO1', client_id: rec.id, account_id: otherAccount.id, entry: '{}' as never, summary: '{}' as never, contact: '{}' as never, submitted_at: new Date() })
      .execute();
    const cookie = await client('x@example.test');
    expect((await get('/api/client/requests', cookie)).json()).toEqual([]);
    const inquiry = await ctx.db.selectFrom('inquiries').select(['account_id', 'client_id']).where('public_ref', '=', 'YT-AMBIGUO1').executeTakeFirstOrThrow();
    expect(inquiry).toEqual({ account_id: otherAccount.id, client_id: rec.id });
    const skipped = await audit('client_account.link_skipped');
    expect(skipped[0].data).toMatchObject({ reason: 'inquiry-from-another-account', earlier: rec.id });
    // the account got a record of its own, without an email that could collide with the earlier one
    const mine = await ctx.db.selectFrom('client_accounts as a').innerJoin('clients as c', 'c.id', 'a.client_id').select(['c.id', 'c.email']).where('a.email', '=', 'x@example.test').executeTakeFirstOrThrow();
    expect(mine.id).not.toBe(rec.id);
    expect(mine.email).toBeNull();
  });

  it('never takes a record another account already holds', async () => {
    await client('holder@example.test');
    const rec = await ctx.db.insertInto('clients').values({ name: 'Y', email: 'y@example.test' }).returning('id').executeTakeFirstOrThrow();
    await ctx.db.updateTable('client_accounts').set({ client_id: rec.id }).where('email', '=', 'holder@example.test').execute();
    await client('y@example.test');
    const skipped = await audit('client_account.link_skipped');
    expect(skipped[0].data).toMatchObject({ reason: 'claimed-by-another-account' });
    const holder = await ctx.db.selectFrom('client_accounts').select('client_id').where('email', '=', 'holder@example.test').executeTakeFirstOrThrow();
    expect(holder.client_id).toBe(rec.id);
  });
});

describe('reference images sent with a first request', () => {
  it('stay private to the client and the studio, and join the request when it is sent', async () => {
    const owner = await signIn(ctx);
    const alice = await client('alice@example.test', 'Alice');
    const bob = await client('bob@example.test', 'Bob');
    const up = await upload(alice);
    expect(up.statusCode).toBe(201);
    const { id: uploadId, url } = up.json();
    // the uploader sees it; another client and the public don't
    expect((await get(url, alice)).statusCode).toBe(200);
    expect((await get(url, bob)).statusCode).toBe(404);
    const asset = await ctx.db.selectFrom('media_assets').select(['visibility', 'variants']).executeTakeFirstOrThrow();
    expect(asset.visibility).toBe('private');
    for (const v of asset.variants) expect((await ctx.app.inject({ method: 'GET', url: `/media/${v.key}` })).statusCode).toBe(404);
    // someone else can't send it with their request
    expect((await post('/api/client/requests', consultationRequest({ referenceUploads: [uploadId] }), bob)).statusCode).toBe(400);
    // sent with Alice's
    const sent = await post('/api/client/requests', consultationRequest({ referenceUploads: [uploadId] }), alice);
    expect(sent.statusCode).toBe(201);
    const detail = (await get(`/api/client/requests/${sent.json().id}`, alice)).json();
    expect(detail.references).toHaveLength(1);
    expect((await get(detail.references[0].url, alice)).statusCode).toBe(200);
    expect((await get(detail.references[0].url, bob)).statusCode).toBe(404);
    // it can't go with a second request
    expect((await post('/api/client/requests', consultationRequest({ referenceUploads: [uploadId] }), alice)).statusCode).toBe(400);
    // Younes reviews it in the studio, behind his session
    const inq = (await studio('GET', `/api/studio/inquiries/${sent.json().id}`, owner.cookie)).json();
    const ref = inq.references.find((r: { kind: string }) => r.kind === 'upload');
    expect(ref.image).toMatch(/^\/api\/studio\/media\//);
    expect((await studio('GET', ref.image, owner.cookie)).statusCode).toBe(200);
    expect((await get(ref.image, alice)).statusCode).toBe(401);
  });

  it('are checked by their bytes, and at most six go with one request', async () => {
    const alice = await client('alice2@example.test');
    expect((await upload(alice, Buffer.from('not an image at all '.repeat(40)))).statusCode).toBe(400);
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push((await upload(alice, await png(`#${(30 + i).toString(16)}2030`))).json().id);
    expect((await post('/api/client/requests', consultationRequest({ referenceUploads: ids }), alice)).statusCode).toBe(400);
  });

  it('are cleared a day after upload if the request was never sent - sent ones stay', async () => {
    const alice = await client('alice3@example.test');
    const kept = (await upload(alice, await png('#112233'))).json();
    const unsent = (await upload(alice, await png('#445566'))).json();
    await post('/api/client/requests', consultationRequest({ referenceUploads: [kept.id] }), alice);
    await ctx.admin.updateTable('client_uploads').set({ created_at: new Date(Date.now() - 2 * 86_400_000) } as never).execute();
    await cleanupMedia(ctx.db, ctx.storage);
    expect(await ctx.db.selectFrom('client_uploads').select('id').where('id', '=', unsent.id).execute()).toHaveLength(0);
    const assets = await ctx.db.selectFrom('media_assets').select(['id', 'deleted_at']).execute();
    expect(assets.filter((a) => a.deleted_at)).toHaveLength(1);
    expect(assets.filter((a) => !a.deleted_at)).toHaveLength(1);
  });
});

describe('answering a proposed time', () => {
  async function proposal(startsInDays = 7) {
    const owner = await signIn(ctx);
    const alice = await client('ann@example.test', 'Ann');
    const c = await ctx.db.selectFrom('clients').select('id').where('email', '=', 'ann@example.test').executeTakeFirstOrThrow();
    const project = (await studio('POST', '/api/studio/projects', owner.cookie, { clientId: c.id, title: 'Moth' })).json();
    const start = new Date(Date.now() + startsInDays * 86_400_000);
    const appt = await studio('POST', '/api/studio/appointments', owner.cookie, { clientId: c.id, projectId: project.id, kind: 'session', title: 'Moth session', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 7_200_000).toISOString(), status: 'proposed' });
    expect(appt.statusCode).toBe(201);
    return { owner, alice, id: appt.json().id as string, clientId: c.id };
  }

  it('the client is told a time was proposed; accepting confirms that very appointment, once, and both sides are told', async () => {
    const { alice, id } = await proposal();
    expect(await ctx.db.selectFrom('email_outbox').select('id').where('template', '=', 'client-appointment-proposed').execute()).toHaveLength(1);
    const r = await post(`/api/client/appointments/${id}/accept`, {}, alice);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ status: 'confirmed', changed: true });
    // a second click changes nothing and books nothing more
    expect((await post(`/api/client/appointments/${id}/accept`, {}, alice)).json()).toEqual({ status: 'confirmed', changed: false });
    const rows = await ctx.db.selectFrom('appointments').select(['id', 'status']).execute();
    expect(rows).toEqual([{ id, status: 'confirmed' }]);
    const sent = (await ctx.db.selectFrom('email_outbox').select('template').execute()).map((m) => m.template);
    expect(sent).toEqual(expect.arrayContaining(['owner-appointment-response', 'client-appointment-answered']));
    expect((await get('/api/client/appointments', alice)).json().upcoming[0].status).toBe('confirmed');
    // a confirmed time can't then be declined from the portal
    expect((await post(`/api/client/appointments/${id}/decline`, {}, alice)).statusCode).toBe(409);
  });

  it('declining cancels it; another client can’t answer it; a time the studio has changed or that has passed can’t be accepted', async () => {
    const { owner, alice, id } = await proposal();
    const bob = await client('bob2@example.test');
    expect((await post(`/api/client/appointments/${id}/accept`, {}, bob)).statusCode).toBe(404);
    // the studio cancels it meanwhile: it's no longer open
    await studio('PATCH', `/api/studio/appointments/${id}`, owner.cookie, { status: 'cancelled' });
    const late = await post(`/api/client/appointments/${id}/accept`, {}, alice);
    expect(late.statusCode).toBe(409);
    expect(late.json().code).toBe('not_proposed');
    // a new proposal, declined
    const start = new Date(Date.now() + 10 * 86_400_000);
    const c = await ctx.db.selectFrom('clients').select('id').where('email', '=', 'ann@example.test').executeTakeFirstOrThrow();
    const again = (await studio('POST', '/api/studio/appointments', owner.cookie, { clientId: c.id, kind: 'session', title: 'Again', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString() })).json();
    expect((await post(`/api/client/appointments/${again.id}/decline`, {}, alice)).json()).toEqual({ status: 'cancelled', changed: true });
    // and one in the past can't be accepted
    await ctx.admin.updateTable('appointments').set({ starts_at: new Date(Date.now() - 86_400_000), ends_at: new Date(Date.now() - 82_800_000), status: 'proposed' } as never).where('id', '=', again.id).execute();
    const passed = await post(`/api/client/appointments/${again.id}/accept`, {}, alice);
    expect(passed.statusCode).toBe(409);
    expect(passed.json().code).toBe('passed');
  });
});

describe('Detroit time', () => {
  it('aftercare reminders go at 10:00 in Detroit - 15:00 UTC in winter, 14:00 UTC in summer', async () => {
    const owner = await signIn(ctx);
    await client('heal@example.test');
    const c = await ctx.db.selectFrom('clients').select('id').executeTakeFirstOrThrow();
    const guide = (await studio('POST', '/api/studio/aftercare/guides', owner.cookie, { title: 'Guide', steps: [{ dayFrom: 0, dayTo: 1, title: 'A', body: 'Text.' }] })).json();
    await studio('POST', `/api/studio/aftercare/guides/${guide.id}/approve`, owner.cookie);
    for (const [day, utc] of [
      ['2027-01-10', '2027-01-10T15:00:00.000Z'],
      ['2027-06-10', '2027-06-10T14:00:00.000Z'],
    ]) {
      const project = (await studio('POST', '/api/studio/projects', owner.cookie, { clientId: c.id, title: `Piece ${day}` })).json();
      await studio('PUT', `/api/studio/projects/${project.id}/aftercare`, owner.cookie, { guideId: guide.id, startedOn: day, reminders: true });
      const plan = await ctx.db.selectFrom('aftercare_plans').select('id').where('project_id', '=', project.id).executeTakeFirstOrThrow();
      const r = await ctx.db.selectFrom('email_outbox').select('send_after').where('related_id', '=', plan.id).executeTakeFirstOrThrow();
      expect(new Date(r.send_after).toISOString()).toBe(utc);
    }
  });

  it('the studio’s time zone is fixed to America/Detroit', async () => {
    const owner = await signIn(ctx);
    expect((await studio('GET', '/api/studio/settings', owner.cookie)).json().timezone).toBe('America/Detroit');
    expect((await studio('PATCH', '/api/studio/settings', owner.cookie, { timezone: 'Europe/Berlin' })).statusCode).toBe(400);
    expect((await studio('PATCH', '/api/studio/settings', owner.cookie, { timezone: 'America/Detroit' })).statusCode).toBe(200);
  });

  it('a proposal email names the time on the studio’s clock', async () => {
    const owner = await signIn(ctx);
    await client('when@example.test');
    const c = await ctx.db.selectFrom('clients').select('id').executeTakeFirstOrThrow();
    const project = (await studio('POST', '/api/studio/projects', owner.cookie, { clientId: c.id, title: 'T' })).json();
    // 16:00 UTC on 2027-01-12 is 11:00 in Detroit (EST)
    await studio('POST', '/api/studio/appointments', owner.cookie, { clientId: c.id, projectId: project.id, kind: 'session', title: 'T', startsAt: '2027-01-12T16:00:00.000Z', endsAt: '2027-01-12T18:00:00.000Z' });
    const m = await ctx.db.selectFrom('email_outbox').select('payload').where('template', '=', 'client-appointment-proposed').executeTakeFirstOrThrow();
    expect((m.payload as { when: string }).when).toBe('Tuesday, January 12 at 11:00 AM (Detroit time)');
  });
});

describe('the client’s own data', () => {
  it('can be reviewed and exported - their own only', async () => {
    const alice = await client('own@example.test', 'Own');
    const bob = await client('else@example.test', 'Else');
    const mine = (await post('/api/client/requests', consultationRequest({ summary: { concept: 'Mine' } }), alice)).json();
    await post('/api/client/requests', consultationRequest({ summary: { concept: 'Not mine' } }), bob);
    const summary = (await get('/api/client/account/data', alice)).json();
    expect(summary.counts).toMatchObject({ requests: 1 });
    expect(summary.retained.length).toBeGreaterThan(0);
    const exp = await get('/api/client/account/export', alice);
    expect(exp.statusCode).toBe(200);
    expect(exp.headers['content-disposition']).toContain('attachment');
    const body = exp.json();
    expect(body.account.email).toBe('own@example.test');
    expect(body.requests.map((r: { reference: string }) => r.reference)).toEqual([mine.ref]);
    expect(exp.body).not.toContain('else@example.test');
    expect(exp.body).not.toContain('Not mine');
  });

  it('closing is a request Younes reviews: nothing is deleted, and closing stops the account', async () => {
    const owner = await signIn(ctx);
    const alice = await client('close@example.test', 'Close');
    await post('/api/client/requests', consultationRequest(), alice);
    expect((await post('/api/client/account/deletion', { confirm: true, reason: 'Moving away' }, alice)).statusCode).toBe(201);
    expect((await post('/api/client/account/deletion', { confirm: true }, alice)).statusCode).toBe(409);
    // withdrawn, then asked again
    expect((await ctx.app.inject({ method: 'DELETE', url: '/api/client/account/deletion', headers: { ...CLIENT, cookie: alice } })).statusCode).toBe(200);
    expect((await post('/api/client/account/deletion', { confirm: true }, alice)).statusCode).toBe(201);
    expect(await ctx.db.selectFrom('email_outbox').select('id').where('template', '=', 'owner-account-request').execute()).toHaveLength(2);
    // the account still works while it waits; nothing is gone
    expect((await get('/api/client/overview', alice)).statusCode).toBe(200);
    const pending = (await studio('GET', '/api/studio/account-requests', owner.cookie)).json().find((r: { status: string }) => r.status === 'pending');
    expect((await studio('PATCH', `/api/studio/account-requests/${pending.id}`, owner.cookie, { action: 'close' })).statusCode).toBe(200);
    // closed: signed out everywhere, can't sign in; the records remain
    expect((await get('/api/client/overview', alice)).statusCode).toBe(401);
    expect((await post('/api/client/login', { email: 'close@example.test', password: PASSWORD })).statusCode).toBe(401);
    expect(await ctx.db.selectFrom('inquiries').select('id').execute()).toHaveLength(1);
    expect(await ctx.db.selectFrom('clients').select('id').execute()).toHaveLength(1);
    expect((await audit('client_account.closed')).length).toBe(1);
  });
});

describe('security checks', () => {
  it('verification and reset links expire', async () => {
    await register('exp@example.test');
    await ctx.admin.updateTable('client_tokens').set({ expires_at: new Date(Date.now() - 1000) } as never).execute();
    expect((await post('/api/client/verify', { token: await tokenFor('exp@example.test', 'client-verify-email') })).statusCode).toBe(400);
    await post('/api/client/verify/resend', { email: 'exp@example.test' });
    await verify('exp@example.test');
    await post('/api/client/password/forgot', { email: 'exp@example.test' });
    await ctx.admin.updateTable('client_tokens').set({ expires_at: new Date(Date.now() - 1000) } as never).where('purpose', '=', 'reset-password').execute();
    expect((await post('/api/client/password/reset', { token: await tokenFor('exp@example.test', 'client-password-reset'), password: 'another long password 99' })).statusCode).toBe(400);
  });

  it('repeated wrong passwords lock the account for a while, even with the right one', async () => {
    await client('lock@example.test');
    for (let i = 0; i < 5; i++) expect((await post('/api/client/login', { email: 'lock@example.test', password: 'wrong password number ' + i })).statusCode).toBe(401);
    expect((await post('/api/client/login', { email: 'lock@example.test', password: PASSWORD })).statusCode).toBe(429);
  });

  it('failed sign-ins from one address lock that address, whichever emails it tries', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await post('/api/client/login', { email: `nobody${i}@example.test`, password: 'whatever it is' })).statusCode);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it('requests are rate-limited per address when limits are on (as in production)', async () => {
    const limited = await makeCtx({ env: { RATE_LIMITS: 'true' } });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) codes.push((await post('/api/client/password/forgot', { email: `someone${i}@example.test` }, undefined, limited)).statusCode);
      expect(codes).toEqual([202, 202, 202, 202, 202, 429]);
    } finally {
      await limited.close();
    }
  });

  it('the public content never carries client details', async () => {
    const alice = await client('private.person@example.test', 'Private Person');
    await post('/api/client/requests', consultationRequest({ summary: { concept: 'A secret idea' } }), alice);
    const pub = await ctx.app.inject({ method: 'GET', url: '/api/public/content' });
    expect(pub.statusCode).toBe(200);
    for (const s of ['private.person@example.test', 'Private Person', 'A secret idea']) expect(pub.body).not.toContain(s);
  });
});
