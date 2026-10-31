import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createOwner } from '../src/modules/auth/service.ts';
import { DEVICE_COOKIE } from '../src/lib/http.ts';
import { cookieOf, makeCtx, OWNER, resetDb, STUDIO, type Ctx } from './helpers.ts';

// TWO_FACTOR=false: the password alone signs in, for a year - and turning it
// back on sends those sessions through the second step
let off: Ctx;
let on: Ctx;
beforeAll(async () => {
  off = await makeCtx({ env: { TWO_FACTOR: 'false' } });
  on = await makeCtx();
});
afterAll(async () => {
  await off.close();
  await on.close();
});
beforeEach(async () => {
  await resetDb(off);
  await createOwner(off.db, OWNER);
});

const login = (ctx: Ctx, password = OWNER.password) =>
  ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: OWNER.email, password }, headers: STUDIO });
const get = (ctx: Ctx, url: string, cookie: string) => ctx.app.inject({ method: 'GET', url, headers: { cookie } });

describe('with two-factor off', () => {
  it('the password alone opens the studio, and the session lasts a year', async () => {
    const r = await login(off);
    expect(r.statusCode).toBe(200);
    expect(r.json().mfa).toBe('ok');
    const cookie = cookieOf(r, off.config.cookieName)!;
    expect((await get(off, '/api/auth/state', cookie)).json().mfa).toBe('ok');
    expect((await get(off, '/api/studio/overview', cookie)).statusCode).toBe(200);

    const set = r.cookies.find((c) => c.name === off.config.cookieName)!;
    expect(set.maxAge).toBe(365 * 24 * 60 * 60);
    const row = await off.db.selectFrom('sessions').select(['absolute_expires_at', 'mfa_passed']).executeTakeFirstOrThrow();
    expect(new Date(row.absolute_expires_at).getTime() - Date.now()).toBeGreaterThan(364 * 86_400_000);
    // the browser becomes a trusted one, as after a full sign-in
    expect(r.cookies.some((c) => c.name === DEVICE_COOKIE)).toBe(true);
  });

  it('a wrong password is still refused', async () => {
    expect((await login(off, 'not the password!!')).statusCode).toBe(401);
  });

  it('turned back on, a session from while it was off must pass the second step', async () => {
    const cookie = cookieOf(await login(off), off.config.cookieName)!;
    expect((await get(on, '/api/auth/state', cookie)).json().mfa).toBe('enroll');
    expect((await get(on, '/api/studio/overview', cookie)).statusCode).toBe(403);
  });
});
