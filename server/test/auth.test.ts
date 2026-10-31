import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createOwner, revokeAllSessions } from '../src/modules/auth/service.ts';
import { DEVICE_COOKIE } from '../src/lib/http.ts';
import { processOutbox } from '../src/modules/notify/service.ts';
import { cookieOf, makeCtx, ORIGIN, OWNER, resetDb, SETUP_TOKEN, signIn, STUDIO, totpCode, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(() => resetDb(ctx));

const post = (url: string, payload?: object, headers: Record<string, string> = {}) => ctx.app.inject({ method: 'POST', url, payload, headers: { ...STUDIO, ...headers } });
const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

describe('first-run owner setup', () => {
  it('needs the server’s setup token, and works only once', async () => {
    expect((await get('/api/auth/state')).json()).toMatchObject({ setupRequired: true, user: null, mfa: 'none' });
    const bad = await post('/api/auth/setup', { setupToken: 'x'.repeat(32), ...OWNER });
    expect(bad.statusCode).toBe(403);
    const ok = await post('/api/auth/setup', { setupToken: SETUP_TOKEN, ...OWNER });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().mfa).toBe('enroll');
    const again = await post('/api/auth/setup', { setupToken: SETUP_TOKEN, ...OWNER, email: 'second@example.test' });
    expect(again.statusCode).toBe(409);
    expect((await get('/api/auth/state')).json().setupRequired).toBe(false);
  });

  it('refuses a second owner from the command-line path too', async () => {
    await createOwner(ctx.db, OWNER);
    await expect(createOwner(ctx.db, { ...OWNER, email: 'other@example.test' })).rejects.toMatchObject({ code: 'owner_exists' });
  });

  it('rejects a weak password', async () => {
    const r = await post('/api/auth/setup', { setupToken: SETUP_TOKEN, ...OWNER, password: 'short' });
    expect(r.statusCode).toBe(400);
    expect(r.json().fields.password).toMatch(/12 characters/);
  });
});

describe('sign-in', () => {
  beforeEach(() => createOwner(ctx.db, OWNER));

  it('wrong password and unknown email get the same answer', async () => {
    const a = await post('/api/auth/login', { email: OWNER.email, password: 'wrong password!!' });
    const b = await post('/api/auth/login', { email: 'nobody@example.test', password: 'wrong password!!' });
    expect([a.statusCode, b.statusCode]).toEqual([401, 401]);
    expect(a.json().title).toBe(b.json().title);
  });

  it('locks the account after repeated failures', async () => {
    for (let i = 0; i < 5; i++) await post('/api/auth/login', { email: OWNER.email, password: `wrong-${i}-password` }, { 'x-forwarded-for': `10.0.0.${i}` });
    const locked = await post('/api/auth/login', { email: OWNER.email, password: OWNER.password });
    expect(locked.statusCode).toBe(429);
  });

  it('a password alone gives no studio access until two-factor is set up', async () => {
    const login = await post('/api/auth/login', { email: OWNER.email, password: OWNER.password });
    const cookie = cookieOf(login, ctx.config.cookieName)!;
    expect(login.json().mfa).toBe('enroll');
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(403);
    expect((await get('/api/auth/state', cookie)).json().mfa).toBe('enroll');
  });

  it('sets a __Host- cookie: HttpOnly, Secure, SameSite=Lax, path /', async () => {
    const login = await post('/api/auth/login', { email: OWNER.email, password: OWNER.password });
    const c = login.cookies.find((x) => x.name === ctx.config.cookieName)!;
    expect(c).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(c.domain).toBeUndefined();
  });
});

describe('two-factor', () => {
  it('enrolment issues recovery codes and replaces the session token', async () => {
    await createOwner(ctx.db, OWNER);
    const login = await post('/api/auth/login', { email: OWNER.email, password: OWNER.password });
    const before = cookieOf(login, ctx.config.cookieName)!;
    const { secret, uri, qrSvg } = (await post('/api/auth/mfa/enroll', undefined, { cookie: before })).json();
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(qrSvg).toMatch(/^<svg/);
    const wrong = await post('/api/auth/mfa/enroll/confirm', { code: '000000' }, { cookie: before });
    expect(wrong.statusCode).toBe(400);
    const ok = await post('/api/auth/mfa/enroll/confirm', { code: totpCode(secret) }, { cookie: before });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().recoveryCodes).toHaveLength(10);
    const after = cookieOf(ok, ctx.config.cookieName)!;
    expect(after).not.toBe(before);
    // the token from before the second step no longer works at all
    expect((await get('/api/auth/me', before)).statusCode).toBe(401);
    expect((await get('/api/studio/overview', after)).statusCode).toBe(200);
  });

  it('next sign-in needs a code; a code can’t be used twice; a recovery code works once', async () => {
    const { secret, recoveryCodes } = await signIn(ctx);
    const login = async () => cookieOf(await post('/api/auth/login', { email: OWNER.email, password: OWNER.password }), ctx.config.cookieName)!;

    let cookie = await login();
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(403);
    // the enrolment code's step was used: the same code is refused
    expect((await post('/api/auth/mfa/verify', { code: totpCode(secret) }, { cookie })).statusCode).toBe(401);
    const next = await post('/api/auth/mfa/verify', { code: totpCode(secret, 1) }, { cookie });
    expect(next.statusCode).toBe(200);
    cookie = cookieOf(next, ctx.config.cookieName)!;
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(200);

    let c2 = await login();
    const rec = await post('/api/auth/mfa/verify', { code: recoveryCodes[0] }, { cookie: c2 });
    expect(rec.statusCode).toBe(200);
    expect(rec.json().recoveryCodesLeft).toBe(9);
    c2 = await login();
    expect((await post('/api/auth/mfa/verify', { code: recoveryCodes[0] }, { cookie: c2 })).statusCode).toBe(401);
  });
});

describe('sessions', () => {
  it('sign-out revokes the session on the server', async () => {
    const { cookie } = await signIn(ctx);
    expect((await post('/api/auth/logout', undefined, { cookie })).statusCode).toBe(200);
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(401);
  });

  it('a revoked session stops working immediately', async () => {
    const { cookie } = await signIn(ctx);
    const owner = await ctx.db.selectFrom('users').select('id').executeTakeFirstOrThrow();
    await revokeAllSessions(ctx.db, owner.id);
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(401);
  });

  it('an expired session is refused', async () => {
    const { cookie } = await signIn(ctx);
    await ctx.db.updateTable('sessions').set({ idle_expires_at: new Date(Date.now() - 1000) }).execute();
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(401);
  });
});

describe('passwords', () => {
  it('reset: same answer for any email, a single-use 30-minute link, every session ended', async () => {
    const { cookie } = await signIn(ctx);
    const unknown = await post('/api/auth/password/forgot', { email: 'nobody@example.test' });
    const known = await post('/api/auth/password/forgot', { email: OWNER.email });
    expect([unknown.statusCode, known.statusCode]).toEqual([202, 202]);
    await processOutbox(ctx.db, ctx.mailer);
    const mail = ctx.mails.find((m) => m.to === OWNER.email)!;
    expect(ctx.mails.filter((m) => m.to === 'nobody@example.test')).toHaveLength(0);
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail.text)![1]);
    const reset = await post('/api/auth/password/reset', { token, password: 'a brand new password 456' });
    expect(reset.statusCode).toBe(200);
    expect((await get('/api/studio/overview', cookie)).statusCode).toBe(401);
    expect((await post('/api/auth/password/reset', { token, password: 'another new password 789' })).statusCode).toBe(400);
    expect((await post('/api/auth/login', { email: OWNER.email, password: 'a brand new password 456' })).statusCode).toBe(200);
  });

  it('change: needs the current password, and signs out every other device', async () => {
    const a = await signIn(ctx);
    const login = await post('/api/auth/login', { email: OWNER.email, password: OWNER.password });
    let other = cookieOf(login, ctx.config.cookieName)!;
    other = cookieOf(await post('/api/auth/mfa/verify', { code: totpCode(a.secret, 1) }, { cookie: other }), ctx.config.cookieName)!;
    expect((await post('/api/auth/password/change', { current: 'wrong one', password: 'a brand new password 456' }, { cookie: a.cookie })).statusCode).toBe(400);
    expect((await post('/api/auth/password/change', { current: OWNER.password, password: 'a brand new password 456' }, { cookie: a.cookie })).statusCode).toBe(200);
    expect((await get('/api/studio/overview', a.cookie)).statusCode).toBe(200);
    expect((await get('/api/studio/overview', other)).statusCode).toBe(401);
  });
});

describe('cross-site request forgery', () => {
  it('refuses state changes from another origin, with no origin, or without the studio header', async () => {
    const { cookie } = await signIn(ctx);
    const url = '/api/studio/follow-ups';
    const body = { clientId: crypto.randomUUID(), kind: 'reply', reason: 'x', dueAt: new Date().toISOString() };
    const evil = await ctx.app.inject({ method: 'POST', url, payload: body, headers: { cookie, origin: 'https://evil.example', 'x-requested-with': 'younes-studio' } });
    const none = await ctx.app.inject({ method: 'POST', url, payload: body, headers: { cookie, 'x-requested-with': 'younes-studio' } });
    const noHeader = await ctx.app.inject({ method: 'POST', url, payload: body, headers: { cookie, origin: ORIGIN } });
    for (const r of [evil, none, noHeader]) {
      expect(r.statusCode).toBe(403);
      expect(r.json().code).toBe('csrf');
    }
    // a public form post from the site itself needs only the origin
    const pub = await ctx.app.inject({ method: 'POST', url: '/api/public/consultations', payload: {}, headers: { origin: 'https://evil.example' } });
    expect(pub.statusCode).toBe(403);
  });
});

describe('every private route is private', () => {
  it('each /api/studio route refuses anonymous callers (401) and half-signed-in ones (403)', async () => {
    await createOwner(ctx.db, OWNER);
    const half = cookieOf(await post('/api/auth/login', { email: OWNER.email, password: OWNER.password }), ctx.config.cookieName)!;
    const routes = ctx.app.routeList.filter((r) => r.url.startsWith('/api/studio'));
    expect(routes.length).toBeGreaterThan(30);
    const fill = (u: string) => u.replace(/:[a-zA-Z]+/g, (m) => (m === ':task' ? 'summary' : '00000000-0000-4000-8000-000000000000'));
    for (const r of routes) {
      const url = fill(r.url);
      const anon = await ctx.app.inject({ method: r.method as 'GET', url, headers: STUDIO, payload: r.method === 'GET' || r.method === 'DELETE' ? undefined : {} });
      expect(anon.statusCode, `${r.method} ${r.url} anonymous`).toBe(401);
      const partial = await ctx.app.inject({ method: r.method as 'GET', url, headers: { ...STUDIO, cookie: half }, payload: r.method === 'GET' || r.method === 'DELETE' ? undefined : {} });
      expect(partial.statusCode, `${r.method} ${r.url} before two-factor`).toBe(403);
    }
  });
});

describe('per-address limits (on, as in production)', () => {
  it('sign-in locks an address after 5 failures; the second step and setup allow 10 tries a minute; forgot-password 5 per 15 minutes', async () => {
    const limited = await makeCtx({ env: { RATE_LIMITS: 'true' } });
    try {
      // sign-in: the address lockout comes first - 5 failures, then 429 (even with a different email each time)
      const logins: number[] = [];
      for (let i = 0; i < 6; i++) logins.push((await limited.app.inject({ method: 'POST', url: '/api/auth/login', headers: STUDIO, payload: { email: `nobody${i}@example.test`, password: 'not the password at all' } })).statusCode);
      expect(logins).toEqual([401, 401, 401, 401, 401, 429]);
      for (const url of ['/api/auth/mfa/verify', '/api/auth/setup']) {
        const codes: number[] = [];
        for (let i = 0; i < 11; i++) {
          const r = await limited.app.inject({ method: 'POST', url, headers: STUDIO, payload: { email: 'nobody@example.test', password: 'not the password at all', code: '000000', setupToken: 'x'.repeat(32), name: 'X' } });
          codes.push(r.statusCode);
        }
        expect(codes.slice(0, 10).includes(429), url).toBe(false);
        expect(codes[10], url).toBe(429);
      }
      // forgot-password: 5 per 15 minutes
      const forgot: number[] = [];
      for (let i = 0; i < 6; i++) forgot.push((await limited.app.inject({ method: 'POST', url: '/api/auth/password/forgot', headers: STUDIO, payload: { email: 'nobody@example.test' } })).statusCode);
      expect(forgot).toEqual([202, 202, 202, 202, 202, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe('the owner can’t be locked out by a stranger', () => {
  /** a sign-in as a given visitor: their own address, and a cookie header if their browser has one */
  const attempt = (password: string, from: string, cookie?: string, email = OWNER.email) =>
    ctx.app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: from, payload: { email, password }, headers: { ...STUDIO, ...(cookie ? { cookie } : {}) } });
  const attack = async (email = OWNER.email) => {
    for (let i = 0; i < 5; i++) await attempt(`guess number ${i} wrong`, `203.0.113.${10 + i}`, undefined, email);
  };

  it('a full sign-in makes the browser a trusted one: its own HttpOnly, Secure, Strict __Host- cookie', async () => {
    const { device, secret } = await signIn(ctx);
    expect(device).toMatch(new RegExp(`^${DEVICE_COOKIE}=`));
    // a password alone doesn't earn it
    const half = await attempt(OWNER.password, '198.51.100.1');
    expect(half.cookies.find((c) => c.name === DEVICE_COOKIE)).toBeUndefined();
    // the second step does - for this new browser, with these attributes
    const verified = await post('/api/auth/mfa/verify', { code: totpCode(secret, 1) }, { cookie: cookieOf(half, ctx.config.cookieName)! });
    expect(verified.statusCode).toBe(200);
    const c = verified.cookies.find((x) => x.name === DEVICE_COOKIE)!;
    expect(c).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
    expect(c.domain).toBeUndefined();
    expect(await ctx.db.selectFrom('trusted_devices').select('id').execute()).toHaveLength(2);
    await ctx.db.deleteFrom('trusted_devices').where('token_hash', '!=', (await ctx.db.selectFrom('trusted_devices').select('token_hash').orderBy('created_at').executeTakeFirstOrThrow()).token_hash).execute();
    const confirmCookie = (await ctx.db.selectFrom('trusted_devices').select(['token_hash', 'expires_at']).execute());
    expect(confirmCookie).toHaveLength(1);
    // stored hashed - the cookie's value appears nowhere in the database
    expect(confirmCookie[0].token_hash.toString('hex')).not.toContain(device.split('=')[1]);
  });

  it('a stranger’s wrong guesses lock the account for unknown browsers - not for the owner’s trusted browser', async () => {
    const { device } = await signIn(ctx);
    await attack();
    // any browser without the owner's device cookie, from anywhere, is held back
    expect((await attempt(OWNER.password, '198.51.100.7')).statusCode).toBe(429);
    // the owner's own browser, from yet another address, signs in
    const owner = await attempt(OWNER.password, '198.51.100.8', device);
    expect(owner.statusCode).toBe(200);
    expect(owner.json().mfa).toBe('verify');
  });

  it('a trusted browser still has its own limit: 5 wrong passwords and it waits too', async () => {
    const { device } = await signIn(ctx);
    for (let i = 0; i < 5; i++) expect((await attempt(`wrong guess ${i} here`, `198.51.100.${20 + i}`, device)).statusCode).toBe(401);
    expect((await attempt(OWNER.password, '198.51.100.30', device)).statusCode).toBe(429);
  });

  it('the device cookie helps only its own account, and locked accounts look alike whether they exist or not', async () => {
    const { device } = await signIn(ctx);
    await attack('nobody@example.test');
    await attack();
    const real = await attempt(OWNER.password, '198.51.100.40');
    const unknown = await attempt('any password at all', '198.51.100.41', device, 'nobody@example.test');
    expect([real.statusCode, unknown.statusCode]).toEqual([429, 429]);
    expect(real.json().title).toBe(unknown.json().title);
  });

  it('a password reset forgets every trusted browser', async () => {
    const { device } = await signIn(ctx);
    await post('/api/auth/password/forgot', { email: OWNER.email });
    await processOutbox(ctx.db, ctx.mailer);
    const token = decodeURIComponent(/token=([^\s]+)/.exec(ctx.mails.at(-1)!.text)![1]);
    expect((await post('/api/auth/password/reset', { token, password: 'a brand new password 456' })).statusCode).toBe(200);
    await attack();
    expect((await attempt('a brand new password 456', '198.51.100.50', device)).statusCode).toBe(429);
  });
});
