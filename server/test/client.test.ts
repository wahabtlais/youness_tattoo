import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cookieOf, consultation, makeCtx, ORIGIN, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

/**
 * The client portal (modules/client): accounts kept apart from the
 * studio's, every portal route behind a verified client, every record
 * scoped to its own client, and the workflow from a request to aftercare.
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

/** the newest one-time link in the outbox for an address, as its token */
async function tokenFor(email: string, template: string) {
  const m = await ctx.db.selectFrom('email_outbox').select('payload').where('to_address', '=', email).where('template', '=', template).orderBy('created_at', 'desc').executeTakeFirstOrThrow();
  return new URL(String((m.payload as { link: string }).link)).searchParams.get('token')!;
}

const post = (url: string, payload: unknown, cookie?: string) => ctx.app.inject({ method: 'POST', url, headers: { ...CLIENT, ...(cookie ? { cookie } : {}) }, payload: payload as never });
const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

/** a client, registered and verified: their portal cookie */
async function client(email: string, name = 'Test Client') {
  expect((await post('/api/client/register', { name, email, password: PASSWORD, consent: true })).statusCode).toBe(202);
  const verify = await post('/api/client/verify', { token: await tokenFor(email, 'client-verify-email') });
  expect(verify.statusCode).toBe(200);
  return cookieOf(verify, COOKIE)!;
}

const consultationRequest = (over: Record<string, unknown> = {}) => ({
  kind: 'consultation',
  idempotencyKey: crypto.randomUUID(),
  entry: { from: 'hero' },
  summary: { concept: 'A heron in the reeds', bodyArea: 'forearm', scale: 'medium' },
  consent: true,
  privacyNoticeVersion: '2026-10-draft',
  ...over,
});

function multipart(file: Buffer, field?: [string, string]) {
  const b = '----younes-client-boundary';
  const parts: Buffer[] = [];
  if (field) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${field[0]}"\r\n\r\n${field[1]}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`), file, Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}
const png = (colour = '#7a2030') => sharp({ create: { width: 800, height: 600, channels: 3, background: colour } }).png().toBuffer();
const uploadAs = async (url: string, cookie: string, headers: Record<string, string>, field?: [string, string], file?: Buffer) => {
  const m = multipart(file ?? (await png()), field);
  return ctx.app.inject({ method: 'POST', url, headers: { ...headers, cookie, ...m.headers }, payload: m.payload });
};

describe('accounts', () => {
  it('registering answers the same for a new address and a known one - only the owner of the address hears more', async () => {
    const first = await post('/api/client/register', { name: 'A', email: 'a@example.test', password: PASSWORD, consent: true });
    const again = await post('/api/client/register', { name: 'Someone else', email: 'a@example.test', password: 'another long password 9', consent: true });
    expect(first.statusCode).toBe(202);
    expect(again.statusCode).toBe(202);
    expect(again.body).toBe(first.body);
    // no session from registering: the email has to be confirmed first
    expect(cookieOf(first, COOKIE)).toBeUndefined();
    const mails = await ctx.db.selectFrom('email_outbox').select(['template', 'to_address']).execute();
    expect(mails.every((m) => m.to_address === 'a@example.test')).toBe(true);
    expect(mails.filter((m) => m.template === 'client-verify-email').length).toBeGreaterThanOrEqual(1);
    // the second registration changed nothing about the first account
    const a = await ctx.db.selectFrom('client_accounts').select(['name']).where('email', '=', 'a@example.test').executeTakeFirstOrThrow();
    expect(a.name).toBe('A');
  });

  it('a known, verified address gets a "you already have an account" note instead', async () => {
    await client('known@example.test');
    await post('/api/client/register', { name: 'X', email: 'known@example.test', password: PASSWORD, consent: true });
    expect(await ctx.db.selectFrom('email_outbox').select('id').where('template', '=', 'client-account-exists').execute()).toHaveLength(1);
  });

  it('nothing opens before the email is verified; the right password then says so, a wrong one doesn’t', async () => {
    await post('/api/client/register', { name: 'B', email: 'b@example.test', password: PASSWORD, consent: true });
    const unverified = await post('/api/client/login', { email: 'b@example.test', password: PASSWORD });
    expect(unverified.statusCode).toBe(403);
    expect(unverified.json().code).toBe('email_unverified');
    expect(cookieOf(unverified, COOKIE)).toBeUndefined();
    expect((await post('/api/client/login', { email: 'b@example.test', password: 'wrong password entirely' })).statusCode).toBe(401);
    expect((await post('/api/client/login', { email: 'nobody@example.test', password: PASSWORD })).statusCode).toBe(401);
  });

  it('a verification link works once, and signs in', async () => {
    await post('/api/client/register', { name: 'C', email: 'c@example.test', password: PASSWORD, consent: true });
    const token = await tokenFor('c@example.test', 'client-verify-email');
    const ok = await post('/api/client/verify', { token });
    expect(ok.statusCode).toBe(200);
    const cookie = cookieOf(ok, COOKIE)!;
    expect((await get('/api/client/session', cookie)).json().account).toMatchObject({ email: 'c@example.test', verified: true });
    expect((await post('/api/client/verify', { token })).statusCode).toBe(400);
    // and signing in works from now on
    const login = await post('/api/client/login', { email: 'c@example.test', password: PASSWORD });
    expect(login.statusCode).toBe(200);
    expect(cookieOf(login, COOKIE)).toBeTruthy();
  });

  it('verifying links the account to the studio’s existing record of that person - their earlier inquiry appears', async () => {
    const sent = await ctx.app.inject({ method: 'POST', url: '/api/public/consultations', headers: { origin: ORIGIN }, payload: consultation({ contact: { name: 'Website Client', email: 'web@example.test' } }) });
    expect(sent.statusCode).toBe(201);
    const cookie = await client('web@example.test', 'Website Client');
    const requests = (await get('/api/client/requests', cookie)).json();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ ref: sent.json().receiptId, statusLabel: 'Pending' });
    expect(await ctx.db.selectFrom('clients').select('id').execute()).toHaveLength(1);
  });

  it('a password reset works once, ends every session, and never says whether the address has an account', async () => {
    const cookie = await client('d@example.test');
    const known = await post('/api/client/password/forgot', { email: 'd@example.test' });
    const unknown = await post('/api/client/password/forgot', { email: 'nobody@example.test' });
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(unknown.body).toBe(known.body);
    const token = await tokenFor('d@example.test', 'client-password-reset');
    expect((await post('/api/client/password/reset', { token, password: 'a brand new password 77' })).statusCode).toBe(200);
    expect((await post('/api/client/password/reset', { token, password: 'a brand new password 78' })).statusCode).toBe(400);
    expect((await get('/api/client/overview', cookie)).statusCode).toBe(401);
    expect((await post('/api/client/login', { email: 'd@example.test', password: PASSWORD })).statusCode).toBe(401);
    expect((await post('/api/client/login', { email: 'd@example.test', password: 'a brand new password 77' })).statusCode).toBe(200);
  });

  it('signing out ends the session on the server', async () => {
    const cookie = await client('e@example.test');
    expect((await post('/api/client/logout', {}, cookie)).statusCode).toBe(200);
    expect((await get('/api/client/overview', cookie)).statusCode).toBe(401);
  });

  it('the profile updates the account and the studio’s record together', async () => {
    const cookie = await client('f@example.test', 'F');
    const r = await ctx.app.inject({ method: 'PATCH', url: '/api/client/profile', headers: { ...CLIENT, cookie }, payload: { name: 'F. Person', phone: '+1 313 555 0101', instagram: '@f.person' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ name: 'F. Person', email: 'f@example.test', phone: '+1 313 555 0101', instagram: 'f.person' });
    const c = await ctx.db.selectFrom('clients').select(['name', 'instagram']).where('email', '=', 'f@example.test').executeTakeFirstOrThrow();
    expect(c).toEqual({ name: 'F. Person', instagram: 'f.person' });
  });
});

describe('the boundary between clients and the studio', () => {
  it('every portal route behind sign-in refuses anonymous callers (401)', async () => {
    const open = new Set(['/api/client/session', '/api/client/register', '/api/client/verify', '/api/client/verify/resend', '/api/client/login', '/api/client/logout', '/api/client/password/forgot', '/api/client/password/reset']);
    const routes = ctx.app.routeList.filter((r) => r.url.startsWith('/api/client') && !open.has(r.url));
    expect(routes.length).toBeGreaterThan(10);
    for (const r of routes) {
      const url = r.url.replace(/:id/g, crypto.randomUUID());
      const res = await ctx.app.inject({ method: r.method as 'GET', url, headers: CLIENT, payload: r.method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(401);
    }
  });

  it('a client’s session opens no studio route, and the studio’s opens no client route', async () => {
    const clientCookie = await client('g@example.test');
    const studio = await signIn(ctx);
    for (const r of ctx.app.routeList.filter((x) => x.url.startsWith('/api/studio'))) {
      const url = r.url.replace(/:id|:task/g, crypto.randomUUID());
      const res = await ctx.app.inject({ method: r.method as 'GET', url, headers: { ...STUDIO, cookie: clientCookie }, payload: r.method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${r.method} ${r.url} with a client session`).toBe(401);
    }
    expect((await get('/api/client/overview', studio.cookie)).statusCode).toBe(401);
    expect((await get('/api/auth/me', clientCookie)).statusCode).toBe(401);
  });

  it('a state-changing portal call from elsewhere, or without the portal’s header, is refused', async () => {
    const cookie = await client('h@example.test');
    const foreign = await ctx.app.inject({ method: 'POST', url: '/api/client/requests', headers: { origin: 'https://evil.example', 'x-requested-with': 'younes-client', cookie }, payload: consultationRequest() });
    expect(foreign.statusCode).toBe(403);
    const unmarked = await ctx.app.inject({ method: 'POST', url: '/api/client/requests', headers: { origin: ORIGIN, cookie }, payload: consultationRequest() });
    expect(unmarked.statusCode).toBe(403);
    // the studio's header doesn't stand in for the portal's
    const studioHeader = await ctx.app.inject({ method: 'POST', url: '/api/client/requests', headers: { ...STUDIO, cookie }, payload: consultationRequest() });
    expect(studioHeader.statusCode).toBe(403);
  });

  it('there is no public way to create a studio account', async () => {
    expect(ctx.app.routeList.some((r) => r.method === 'POST' && /\/api\/(auth|studio)\/(register|users|signup)/.test(r.url))).toBe(false);
    // and a client account is never a studio user
    await client('i@example.test');
    expect(await ctx.db.selectFrom('users').select('id').execute()).toHaveLength(0);
  });

  it('the website’s anonymous consultation form is closed by default: an account is needed', async () => {
    const strict = await makeCtx({ env: { ANONYMOUS_CONSULTATIONS: 'false' } });
    try {
      const r = await strict.app.inject({ method: 'POST', url: '/api/public/consultations', headers: { origin: ORIGIN }, payload: consultation() });
      expect(r.statusCode).toBe(403);
      expect(r.json().code).toBe('account_required');
    } finally {
      await strict.close();
    }
  });
});

describe('one client never sees another’s records', () => {
  it('requests, projects, images, messages, bookings and healing photos of another client answer 404', async () => {
    const studio = await signIn(ctx);
    const alice = await client('alice@example.test', 'Alice');
    const bob = await client('bob@example.test', 'Bob');

    const req = (await post('/api/client/requests', consultationRequest(), alice)).json();
    const aliceClient = await ctx.db.selectFrom('clients').select('id').where('email', '=', 'alice@example.test').executeTakeFirstOrThrow();
    const project = (await ctx.app.inject({ method: 'POST', url: '/api/studio/projects', headers: { ...STUDIO, cookie: studio.cookie }, payload: { clientId: aliceClient.id, inquiryId: req.id, title: 'Heron' } })).json();
    const ref = (await uploadAs(`/api/client/projects/${project.id}/references`, alice, CLIENT, ['caption', 'Mine'])).json();
    const mediaId = ref.url.split('/').pop();

    // Alice sees her own
    expect((await get(`/api/client/requests/${req.id}`, alice)).statusCode).toBe(200);
    expect((await get(`/api/client/projects/${project.id}`, alice)).statusCode).toBe(200);
    expect((await get(`/api/client/media/${mediaId}`, alice)).statusCode).toBe(200);

    // Bob, with Alice's ids, gets nothing - the same answer as for an id that doesn't exist
    expect((await get(`/api/client/requests/${req.id}`, bob)).statusCode).toBe(404);
    expect((await get(`/api/client/projects/${project.id}`, bob)).statusCode).toBe(404);
    expect((await get(`/api/client/media/${mediaId}`, bob)).statusCode).toBe(404);
    expect((await post(`/api/client/requests/${req.id}/messages`, { body: 'hi' }, bob)).statusCode).toBe(404);
    expect((await post(`/api/client/projects/${project.id}/messages`, { body: 'hi' }, bob)).statusCode).toBe(404);
    expect((await post('/api/client/requests', { kind: 'booking', idempotencyKey: crypto.randomUUID(), projectId: project.id, preferredTimes: 'Any Friday', consent: true, privacyNoticeVersion: 'x' }, bob)).statusCode).toBe(404);
    expect((await uploadAs(`/api/client/projects/${project.id}/references`, bob, CLIENT)).statusCode).toBe(404);
    expect((await uploadAs(`/api/client/projects/${project.id}/healing-photos`, bob, CLIENT)).statusCode).toBe(404);
    // Bob's lists are empty
    expect((await get('/api/client/requests', bob)).json()).toEqual([]);
    expect((await get('/api/client/projects', bob)).json()).toEqual([]);
    expect((await get('/api/client/appointments', bob)).json().upcoming).toEqual([]);
    // the request's draft key can't be replayed into another client's history
    const replay = await post('/api/client/requests', consultationRequest({ idempotencyKey: (await ctx.db.selectFrom('inquiries').select('idempotency_key').where('id', '=', req.id).executeTakeFirstOrThrow()).idempotency_key }), bob);
    expect(replay.statusCode).toBe(409);
  });

  it('a private image is never served by the public media route', async () => {
    const studio = await signIn(ctx);
    const alice = await client('alice2@example.test');
    const c = await ctx.db.selectFrom('clients').select('id').executeTakeFirstOrThrow();
    const project = (await ctx.app.inject({ method: 'POST', url: '/api/studio/projects', headers: { ...STUDIO, cookie: studio.cookie }, payload: { clientId: c.id, title: 'Private' } })).json();
    await uploadAs(`/api/client/projects/${project.id}/references`, alice, CLIENT);
    const asset = await ctx.db.selectFrom('media_assets').select(['variants', 'visibility']).executeTakeFirstOrThrow();
    expect(asset.visibility).toBe('private');
    for (const v of asset.variants) {
      expect(v.key.startsWith('private/')).toBe(true);
      expect((await ctx.app.inject({ method: 'GET', url: `/media/${v.key}` })).statusCode).toBe(404);
      expect((await ctx.app.inject({ method: 'GET', url: `/media/public/${v.key.replace(/^private\//, '')}` })).statusCode).toBe(404);
    }
  });

  it('uploads are judged by their bytes: a file that isn’t an image is refused', async () => {
    const studio = await signIn(ctx);
    const alice = await client('alice3@example.test');
    const c = await ctx.db.selectFrom('clients').select('id').executeTakeFirstOrThrow();
    const project = (await ctx.app.inject({ method: 'POST', url: '/api/studio/projects', headers: { ...STUDIO, cookie: studio.cookie }, payload: { clientId: c.id, title: 'Uploads' } })).json();
    const r = await uploadAs(`/api/client/projects/${project.id}/references`, alice, CLIENT, undefined, Buffer.from('<script>alert(1)</script>'.repeat(30)));
    expect(r.statusCode).toBe(400);
    expect(await ctx.db.selectFrom('project_media').select('id').execute()).toHaveLength(0);
  });
});

describe('from a request to aftercare', () => {
  it('runs end to end: request, conversation, project, appointment, aftercare, healing photo and answer', async () => {
    const studio = await signIn(ctx);
    const sh = { ...STUDIO, cookie: studio.cookie };
    const alice = await client('flow@example.test', 'Flow Client');

    // a request - pending, and not an appointment
    const req = await post('/api/client/requests', consultationRequest(), alice);
    expect(req.statusCode).toBe(201);
    const { id: inquiryId } = req.json();
    expect((await get('/api/client/requests', alice)).json()[0]).toMatchObject({ statusLabel: 'Pending', kind: 'consultation' });
    expect(await ctx.db.selectFrom('appointments').select('id').execute()).toHaveLength(0);
    const inquiry = await ctx.db.selectFrom('inquiries').selectAll().where('id', '=', inquiryId).executeTakeFirstOrThrow();
    expect(inquiry.account_id).toBeTruthy();
    expect(inquiry.contact).toMatchObject({ name: 'Flow Client', email: 'flow@example.test' });

    // the studio asks for more; the client sees it and answers
    await ctx.app.inject({ method: 'PATCH', url: `/api/studio/inquiries/${inquiryId}/status`, headers: sh, payload: { status: 'changes-requested' } });
    const ask = await ctx.app.inject({ method: 'POST', url: `/api/studio/inquiries/${inquiryId}/messages`, headers: sh, payload: { body: 'Which arm, and how large?' } });
    expect(ask.statusCode).toBe(201);
    const told = await ctx.db.selectFrom('email_outbox').select(['template', 'payload']).where('to_address', '=', 'flow@example.test').where('template', '=', 'client-new-message').executeTakeFirstOrThrow();
    // the email says there's a message - never what it says
    expect(JSON.stringify(told.payload)).not.toContain('Which arm');
    const overview = (await get('/api/client/overview', alice)).json();
    expect(overview.actions.map((a: { kind: string }) => a.kind)).toEqual(expect.arrayContaining(['request', 'message']));
    const detail = (await get(`/api/client/requests/${inquiryId}`, alice)).json();
    expect(detail).toMatchObject({ statusLabel: 'More information needed', messages: [{ from: 'studio', body: 'Which arm, and how large?' }] });
    expect((await post(`/api/client/requests/${inquiryId}/messages`, { body: 'Left forearm, palm-sized.' }, alice)).statusCode).toBe(201);
    const thread = (await ctx.app.inject({ method: 'GET', url: `/api/studio/inquiries/${inquiryId}/portal`, headers: sh })).json();
    expect(thread.messages.map((m: { from: string }) => m.from)).toEqual(['studio', 'client']);
    expect(thread.account).toMatchObject({ email: 'flow@example.test', verified: true });

    // accepted; a project from it, carrying the idea over
    await ctx.app.inject({ method: 'PATCH', url: `/api/studio/inquiries/${inquiryId}/status`, headers: sh, payload: { status: 'accepted' } });
    const c = await ctx.db.selectFrom('clients').select('id').where('email', '=', 'flow@example.test').executeTakeFirstOrThrow();
    const created = await ctx.app.inject({ method: 'POST', url: '/api/studio/projects', headers: sh, payload: { clientId: c.id, inquiryId, title: 'Heron in the reeds' } });
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id;
    expect((await ctx.app.inject({ method: 'POST', url: '/api/studio/projects', headers: sh, payload: { clientId: c.id, inquiryId, title: 'Again' } })).statusCode).toBe(409);
    const mine = (await get(`/api/client/projects/${projectId}`, alice)).json();
    expect(mine).toMatchObject({ title: 'Heron in the reeds', concept: 'A heron in the reeds', placement: 'Forearm', size: 'Medium', statusLabel: 'In design' });

    // the client adds a reference; the studio sees it, and adds a design
    expect((await uploadAs(`/api/client/projects/${projectId}/references`, alice, CLIENT, ['caption', 'Like this pose'])).statusCode).toBe(201);
    const design = await uploadAs(`/api/studio/projects/${projectId}/designs`, studio.cookie, STUDIO, ['caption', 'First sketch'], await png('#203040'));
    expect(design.statusCode).toBe(201);
    const studioView = (await ctx.app.inject({ method: 'GET', url: `/api/studio/projects/${projectId}`, headers: sh })).json();
    expect(studioView.media.map((m: { kind: string; addedBy: string }) => `${m.kind}:${m.addedBy}`)).toEqual(['reference:client', 'design:studio']);
    expect((await ctx.app.inject({ method: 'GET', url: studioView.media[0].url, headers: sh })).statusCode).toBe(200);
    const clientMedia = (await get(`/api/client/projects/${projectId}`, alice)).json().media;
    expect(clientMedia).toHaveLength(2);
    for (const m of clientMedia) expect((await get(m.url, alice)).statusCode).toBe(200);

    // a booking request on the project - still not an appointment until the studio makes one
    const booking = await post('/api/client/requests', { kind: 'booking', idempotencyKey: crypto.randomUUID(), projectId, preferredTimes: 'Weekday mornings', consent: true, privacyNoticeVersion: '2026-10-draft' }, alice);
    expect(booking.statusCode).toBe(201);
    expect(await ctx.db.selectFrom('appointments').select('id').execute()).toHaveLength(0);
    const start = new Date(Date.now() + 7 * 86_400_000);
    const appt = await ctx.app.inject({
      method: 'POST',
      url: '/api/studio/appointments',
      headers: sh,
      payload: { clientId: c.id, projectId, kind: 'session', title: 'Heron session', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3 * 3_600_000).toISOString(), status: 'proposed', prep: 'Eat a good breakfast.' },
    });
    expect(appt.statusCode).toBe(201);
    const appts = (await get('/api/client/appointments', alice)).json();
    expect(appts.upcoming).toHaveLength(1);
    expect(appts.upcoming[0]).toMatchObject({ title: 'Heron session', status: 'proposed', prep: 'Eat a good breakfast.', projectTitle: 'Heron in the reeds' });
    // another client's project can't be attached to this client's appointment
    const other = await client('other@example.test');
    void other;
    const otherClient = await ctx.db.selectFrom('clients').select('id').where('email', '=', 'other@example.test').executeTakeFirstOrThrow();
    const wrong = await ctx.app.inject({ method: 'POST', url: '/api/studio/appointments', headers: sh, payload: { clientId: otherClient.id, projectId, kind: 'session', title: 'X', startsAt: new Date(start.getTime() + 86_400_000).toISOString(), endsAt: new Date(start.getTime() + 90_000_000).toISOString() } });
    expect(wrong.statusCode).toBe(400);

    // aftercare: Younes writes a guide; it can't be given until he approves it
    const guide = await ctx.app.inject({
      method: 'POST',
      url: '/api/studio/aftercare/guides',
      headers: sh,
      payload: { title: 'Test guide', intro: 'Written by the studio for this test.', steps: [{ dayFrom: 0, dayTo: 2, title: 'Stage one', body: 'Instructions as the artist writes them.' }, { dayFrom: 3, dayTo: 14, title: 'Stage two', body: 'Further instructions.' }, { dayFrom: 30, title: 'Later', body: 'Later instructions.' }] },
    });
    expect(guide.statusCode).toBe(201);
    const guideId = guide.json().id;
    const today = new Date().toISOString().slice(0, 10);
    const early = await ctx.app.inject({ method: 'PUT', url: `/api/studio/projects/${projectId}/aftercare`, headers: sh, payload: { guideId, startedOn: today, reminders: true } });
    expect(early.statusCode).toBe(409);
    expect((await ctx.app.inject({ method: 'POST', url: `/api/studio/aftercare/guides/${guideId}/approve`, headers: sh })).statusCode).toBe(200);
    const given = await ctx.app.inject({ method: 'PUT', url: `/api/studio/projects/${projectId}/aftercare`, headers: sh, payload: { guideId, startedOn: today, reminders: true } });
    expect(given.statusCode).toBe(200);
    // reminders only for stages still ahead, each at its own day
    expect(given.json().reminders).toBe(2);
    const reminders = await ctx.db.selectFrom('email_outbox').select(['send_after', 'to_address']).where('template', '=', 'aftercare-reminder').orderBy('send_after').execute();
    expect(reminders.map((r) => r.to_address)).toEqual(['flow@example.test', 'flow@example.test']);
    expect(new Date(reminders[0].send_after).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);

    // editing the guide un-approves it - but the client keeps the text they were given
    await ctx.app.inject({ method: 'PUT', url: `/api/studio/aftercare/guides/${guideId}`, headers: sh, payload: { title: 'Test guide', steps: [{ dayFrom: 0, title: 'Changed', body: 'Changed text.' }] } });
    const care = (await get('/api/client/aftercare', alice)).json();
    expect(care.plans).toHaveLength(1);
    expect(care.plans[0]).toMatchObject({ day: 0, title: 'Test guide' });
    expect(care.plans[0].steps.map((s: { title: string; state: string }) => `${s.title}:${s.state}`)).toEqual(['Stage one:current', 'Stage two:upcoming', 'Later:upcoming']);
    expect((await get(`/api/client/projects/${projectId}`, alice)).json().statusLabel).toBe('Healing');

    // a healing photo, answered by the studio
    const photo = await uploadAs(`/api/client/projects/${projectId}/healing-photos`, alice, CLIENT, ['note', 'Day one, a little red']);
    expect(photo.statusCode).toBe(201);
    const inbox = (await ctx.app.inject({ method: 'GET', url: '/api/studio/portal/inbox', headers: sh })).json();
    expect(inbox.photos).toHaveLength(1);
    const answered = await ctx.app.inject({ method: 'PATCH', url: `/api/studio/healing-photos/${photo.json().id}`, headers: sh, payload: { response: 'Looks as expected for day one.' } });
    expect(answered.statusCode).toBe(200);
    const after = (await get('/api/client/aftercare', alice)).json();
    expect(after.plans[0].photos[0]).toMatchObject({ note: 'Day one, a little red', response: 'Looks as expected for day one.' });
    expect((await get(after.plans[0].photos[0].url, alice)).statusCode).toBe(200);

    // the studio's client record shows the account and the project
    const record = (await ctx.app.inject({ method: 'GET', url: `/api/studio/clients/${c.id}`, headers: sh })).json();
    expect(record.account).toMatchObject({ email: 'flow@example.test', verified: true });
    expect(record.projects.map((p: { title: string }) => p.title)).toEqual(['Heron in the reeds']);
  });
});
