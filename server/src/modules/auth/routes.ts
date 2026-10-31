import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, mfaCodeSchema, resetPasswordSchema, setupOwnerSchema, type AuthState } from '@younes/contracts';
import { AppError, notFound, parse, unauthenticated } from '../../lib/errors.ts';
import { clearSessionCookie, DEVICE_COOKIE, requireUser, setDeviceCookie, setSessionCookie, type Deps } from '../../lib/http.ts';
import * as auth from './service.ts';

/**
 * /api/auth - signing in. Every response that starts or upgrades a session
 * replaces the cookie; sign-out revokes the session server-side (deleting
 * the cookie alone wouldn't). Login, the second step and reset requests
 * are rate-limited per address on top of the per-account lockout.
 */
export async function authRoutes(app: FastifyInstance, { db, config }: Deps) {
  const policy = auth.sessionPolicy(config);
  const meta = (req: { ip: string; headers: Record<string, unknown>; cookies: Record<string, string | undefined> }) => ({
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] ?? ''),
    deviceToken: req.cookies[DEVICE_COOKIE],
  });
  /** a full sign-in: this browser becomes (or stays) a trusted one */
  const trust = async (req: Parameters<typeof meta>[0], reply: Parameters<typeof setDeviceCookie>[0], userId: string) => {
    const token = await auth.trustDevice(db, userId, req.cookies[DEVICE_COOKIE], String(req.headers['user-agent'] ?? ''));
    if (token) setDeviceCookie(reply, token);
  };
  const strict = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  app.get('/state', async (req): Promise<AuthState> => {
    const a = req.auth;
    return {
      setupRequired: !(await auth.ownerExists(db)),
      user: a ? { id: a.user.id, name: a.user.name, email: a.user.email, role: a.user.role } : null,
      mfa: a ? auth.mfaState(a) : 'none',
    };
  });

  /** the first owner, from the browser - only with the server's setup token, only once */
  app.post('/setup', { config: strict }, async (req, reply) => {
    const body = parse(setupOwnerSchema, req.body);
    const expected = config.OWNER_SETUP_TOKEN;
    const ok = !!expected && body.setupToken.length === expected.length && timingSafeEqual(Buffer.from(body.setupToken), Buffer.from(expected));
    if (!ok) throw new AppError(403, 'setup_token', 'That setup token isn’t right. It’s in server/.env (OWNER_SETUP_TOKEN), or create the owner with npm run owner:create.');
    await auth.createOwner(db, body);
    const { token, mfa, userId } = await auth.login(db, { email: body.email, password: body.password }, meta(req), policy);
    setSessionCookie(reply, config, token);
    if (mfa === 'ok') await trust(req, reply, userId);
    return { mfa };
  });

  app.post('/login', { config: strict }, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    if (req.auth) await auth.revokeSession(db, req.auth.session.id);
    const { token, mfa, userId } = await auth.login(db, body, meta(req), policy);
    setSessionCookie(reply, config, token);
    // with two-factor off the password is the whole sign-in: trust the browser now
    if (mfa === 'ok') await trust(req, reply, userId);
    return { mfa };
  });

  app.post('/logout', async (req, reply) => {
    if (req.auth) await auth.revokeSession(db, req.auth.session.id);
    clearSessionCookie(reply, config);
    return { ok: true };
  });

  app.post('/mfa/enroll', { config: strict }, async (req) => {
    const a = auth.requireAuth(req.auth);
    return auth.startEnrollment(db, config, a);
  });

  app.post('/mfa/enroll/confirm', { config: strict }, async (req, reply) => {
    const a = auth.requireAuth(req.auth);
    const { code } = parse(mfaCodeSchema, req.body);
    const { token, recoveryCodes } = await auth.confirmEnrollment(db, config, a, code);
    setSessionCookie(reply, config, token);
    await trust(req, reply, a.user.id);
    return { recoveryCodes };
  });

  app.post('/mfa/verify', { config: strict }, async (req, reply) => {
    const a = auth.requireAuth(req.auth);
    const { code } = parse(mfaCodeSchema, req.body);
    const { token, recoveryCodesLeft } = await auth.verifySecondStep(db, config, a, code);
    setSessionCookie(reply, config, token);
    await trust(req, reply, a.user.id);
    return { ok: true, recoveryCodesLeft };
  });

  app.post('/password/forgot', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    await auth.requestPasswordReset(db, config, email);
    // the same answer either way: it never reveals whether an account exists
    return reply.code(202).send({ ok: true });
  });

  app.post('/password/reset', { config: strict }, async (req, reply) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await auth.resetPassword(db, token, password);
    clearSessionCookie(reply, config);
    return { ok: true };
  });

  app.post('/password/change', { config: strict }, async (req) => {
    const a = requireUser(req);
    const { current, password } = parse(changePasswordSchema, req.body);
    await auth.changePassword(db, a, current, password);
    return { ok: true };
  });

  app.get('/sessions', async (req) => {
    const a = requireUser(req);
    return auth.listSessions(db, a.user.id, a.session.id);
  });

  app.delete<{ Params: { id: string } }>('/sessions/:id', async (req) => {
    const a = requireUser(req);
    const mine = (await auth.listSessions(db, a.user.id, a.session.id)).find((s) => s.id === req.params.id);
    if (!mine) throw notFound();
    await auth.revokeSession(db, mine.id);
    return { ok: true };
  });

  app.post('/sessions/revoke-others', async (req) => {
    const a = requireUser(req);
    await auth.revokeAllSessions(db, a.user.id, a.session.id);
    return { ok: true };
  });

  // a session that isn't there can't be refreshed: say so plainly
  app.get('/me', async (req) => {
    if (!req.auth) throw unauthenticated();
    return { id: req.auth.user.id, name: req.auth.user.name, email: req.auth.user.email, role: req.auth.user.role, mfa: auth.mfaState(req.auth) };
  });
}
