import { randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { sql } from 'kysely';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import type { Session, User } from '../../db/types.ts';
import { decrypt, encrypt, randomToken, sha256 } from '../../lib/crypto.ts';
import { AppError, badRequest, conflict, tooMany, unauthenticated } from '../../lib/errors.ts';
import { record } from '../audit/service.ts';
import { enqueue } from '../notify/service.ts';
import { burnTime, hashPassword, verifyPassword } from './passwords.ts';

/**
 * Accounts and sessions.
 *
 * A session is a row; the browser holds only its random token (in an
 * HttpOnly cookie), the database only the token's hash. Sessions end after
 * 12 idle hours or 30 days at most, on sign-out, and all at once when the
 * password changes. A new session starts with `mfa_passed = false`: the
 * owner reaches the studio only after the second step - enrolling an
 * authenticator the first time, a code (or a recovery code) after that -
 * and the token is replaced at that moment, so a token seen before the
 * second step is worthless after it.
 */

export const IDLE_MS = 12 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
/** last-seen is written at most this often (not on every request) */
const TOUCH_MS = 5 * 60 * 1000;

export interface AuthContext {
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'totp_enabled_at'>;
  session: Pick<Session, 'id' | 'mfa_passed' | 'created_at'>;
}

export type MfaState = 'enroll' | 'verify' | 'ok';
export const mfaState = (a: AuthContext): MfaState => (!a.user.totp_enabled_at ? 'enroll' : a.session.mfa_passed ? 'ok' : 'verify');

// ---------------- owner ----------------

export async function ownerExists(db: Executor) {
  return !!(await db.selectFrom('users').select('id').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst());
}

/** the first and only owner - a second is refused here and by the database (users_single_owner) */
export async function createOwner(db: DB, input: { name: string; email: string; password: string }) {
  return db.transaction().execute(async (tx) => {
    // serialise concurrent setups
    await sql`lock table users in share row exclusive mode`.execute(tx);
    if (await ownerExists(tx)) throw conflict('The studio already has an owner.', 'owner_exists');
    const user = await tx
      .insertInto('users')
      .values({ name: input.name.trim(), email: input.email.trim().toLowerCase(), password_hash: await hashPassword(input.password), role: 'owner' })
      .returning(['id', 'email', 'name'])
      .executeTakeFirstOrThrow();
    await record(tx, { type: 'system' }, 'auth.owner_created', { type: 'user', id: user.id });
    return user;
  });
}

// ---------------- brute-force protection ----------------
//
// Three counters, each with 5 free failures per 15 minutes, then a lock
// that doubles (1, 2, 4 … minutes, at most an hour):
//   ip:<address>   every sign-in from one address
//   email:<email>  every sign-in for one account, from anywhere - stops a
//                  spread-out guessing attack, but anyone who knows the
//                  owner's email could trip it...
//   device:<id>    ...so a browser the owner has fully signed in on before
//                  (a trusted device, below) is judged by its own counter
//                  instead of the account's: a stranger's failures can't
//                  lock the owner out of their own browser.
// Unknown and real emails are counted and answered alike: nothing reveals
// whether an account exists.

const WINDOW_MS = 15 * 60 * 1000;
const FREE_FAILURES = 5;

async function checkLock(db: Executor, key: string) {
  const row = await db.selectFrom('auth_attempts').selectAll().where('key', '=', key).executeTakeFirst();
  if (row?.locked_until && new Date(row.locked_until) > new Date()) throw tooMany('Too many attempts. Please wait a few minutes and try again.');
}

async function fail(db: Executor, key: string) {
  const now = new Date();
  const row = await db.selectFrom('auth_attempts').selectAll().where('key', '=', key).executeTakeFirst();
  const fresh = !row || now.getTime() - new Date(row.window_start).getTime() > WINDOW_MS;
  const failures = fresh ? 1 : row!.failures + 1;
  // 5 free tries per 15 minutes; then 1, 2, 4 … minutes locked, up to an hour
  const lockMin = failures >= FREE_FAILURES ? Math.min(60, 2 ** (failures - FREE_FAILURES)) : 0;
  await db
    .insertInto('auth_attempts')
    .values({ key, failures, window_start: fresh ? now : row!.window_start, locked_until: lockMin ? new Date(now.getTime() + lockMin * 60_000) : null })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ failures: eb.ref('excluded.failures'), window_start: eb.ref('excluded.window_start'), locked_until: eb.ref('excluded.locked_until') })))
    .execute();
}

const clearFailures = (db: Executor, key: string) => db.deleteFrom('auth_attempts').where('key', '=', key).execute();

// ---------------- sessions ----------------

async function newSession(db: Executor, userId: string, meta: { ip?: string; userAgent?: string }, mfaPassed = false) {
  const token = randomToken();
  const now = Date.now();
  await db
    .insertInto('sessions')
    .values({
      user_id: userId,
      token_hash: sha256(token),
      mfa_passed: mfaPassed,
      idle_expires_at: new Date(now + IDLE_MS),
      absolute_expires_at: new Date(now + ABSOLUTE_MS),
      ip: meta.ip ?? null,
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
    })
    .execute();
  return token;
}

/** a valid session for the token, renewing its idle expiry; null when there's none */
export async function sessionFromToken(db: Executor, token: string | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 100) return null;
  const now = new Date();
  const row = await db
    .selectFrom('sessions as s')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .select(['s.id as session_id', 's.mfa_passed', 's.created_at', 's.last_seen_at', 's.absolute_expires_at', 'u.id', 'u.name', 'u.email', 'u.role', 'u.totp_enabled_at'])
    .where('s.token_hash', '=', sha256(token))
    .where('s.revoked_at', 'is', null)
    .where('s.idle_expires_at', '>', now)
    .where('s.absolute_expires_at', '>', now)
    .where('u.disabled_at', 'is', null)
    .executeTakeFirst();
  if (!row) return null;
  if (now.getTime() - new Date(row.last_seen_at).getTime() > TOUCH_MS) {
    const idle = new Date(Math.min(now.getTime() + IDLE_MS, new Date(row.absolute_expires_at).getTime()));
    await db.updateTable('sessions').set({ last_seen_at: now, idle_expires_at: idle }).where('id', '=', row.session_id).execute();
  }
  return {
    user: { id: row.id, name: row.name, email: row.email, role: row.role, totp_enabled_at: row.totp_enabled_at },
    session: { id: row.session_id, mfa_passed: row.mfa_passed, created_at: row.created_at },
  };
}

/** replace a session's token (after the second step): the old token stops working */
async function rotate(db: Executor, sessionId: string, mfaPassed: boolean) {
  const token = randomToken();
  await db.updateTable('sessions').set({ token_hash: sha256(token), mfa_passed: mfaPassed, last_seen_at: new Date() }).where('id', '=', sessionId).execute();
  return token;
}

export async function revokeSession(db: Executor, sessionId: string) {
  await db.updateTable('sessions').set({ revoked_at: new Date() }).where('id', '=', sessionId).where('revoked_at', 'is', null).execute();
}

export async function revokeAllSessions(db: Executor, userId: string, except?: string) {
  let q = db.updateTable('sessions').set({ revoked_at: new Date() }).where('user_id', '=', userId).where('revoked_at', 'is', null);
  if (except) q = q.where('id', '!=', except);
  await q.execute();
}

export async function listSessions(db: Executor, userId: string, currentId: string) {
  const rows = await db
    .selectFrom('sessions')
    .select(['id', 'created_at', 'last_seen_at', 'ip', 'user_agent', 'mfa_passed'])
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .where('idle_expires_at', '>', new Date())
    .where('absolute_expires_at', '>', new Date())
    .orderBy('last_seen_at', 'desc')
    .execute();
  return rows.map((r) => ({ id: r.id, createdAt: new Date(r.created_at).toISOString(), lastSeenAt: new Date(r.last_seen_at).toISOString(), ip: r.ip, userAgent: r.user_agent, current: r.id === currentId }));
}

// ---------------- trusted devices ----------------

export const DEVICE_MS = 180 * 24 * 60 * 60 * 1000;

/** the trusted device behind a cookie token, if it's live - and whose it is */
async function trustedDevice(db: Executor, token: string | undefined) {
  if (!token || token.length > 100) return null;
  return (
    (await db
      .selectFrom('trusted_devices as d')
      .innerJoin('users as u', 'u.id', 'd.user_id')
      .select(['d.id', 'd.user_id', 'u.email'])
      .where('d.token_hash', '=', sha256(token))
      .where('d.revoked_at', 'is', null)
      .where('d.expires_at', '>', new Date())
      .where('u.disabled_at', 'is', null)
      .executeTakeFirst()) ?? null
  );
}

/**
 * After a full sign-in: the browser's device token - the one it already
 * holds (kept, its use noted) or a new one. Returns a token to set as the
 * cookie only when it's new.
 */
export async function trustDevice(db: Executor, userId: string, current: string | undefined, userAgent?: string): Promise<string | null> {
  const known = await trustedDevice(db, current);
  if (known && known.user_id === userId) {
    await db.updateTable('trusted_devices').set({ last_used_at: new Date(), expires_at: new Date(Date.now() + DEVICE_MS) }).where('id', '=', known.id).execute();
    return null;
  }
  const token = randomToken();
  await db
    .insertInto('trusted_devices')
    .values({ user_id: userId, token_hash: sha256(token), expires_at: new Date(Date.now() + DEVICE_MS), user_agent: userAgent?.slice(0, 300) ?? null })
    .execute();
  return token;
}

/** every trusted browser forgotten - with a reset, everything starts again */
export const forgetDevices = (db: Executor, userId: string) => db.updateTable('trusted_devices').set({ revoked_at: new Date() }).where('user_id', '=', userId).where('revoked_at', 'is', null).execute();

// ---------------- sign-in ----------------

export async function login(db: DB, input: { email: string; password: string }, meta: { ip?: string; userAgent?: string; deviceToken?: string }) {
  const ipKey = `ip:${meta.ip ?? 'unknown'}`;
  // a trusted browser of this very account answers to its own counter, not the account's
  const device = await trustedDevice(db, meta.deviceToken);
  const accountKey = device && device.email === input.email ? `device:${device.id}` : `email:${input.email}`;
  await checkLock(db, accountKey);
  await checkLock(db, ipKey);
  const user = await db.selectFrom('users').selectAll().where('email', '=', input.email).where('disabled_at', 'is', null).executeTakeFirst();
  const ok = user ? await verifyPassword(user.password_hash, input.password) : (await burnTime(input.password), false);
  if (!user || !ok) {
    await fail(db, accountKey);
    await fail(db, ipKey);
    throw new AppError(401, 'invalid_credentials', 'That email and password don’t match.');
  }
  // the owner is in: their account's and this browser's slates are clean
  await clearFailures(db, `email:${input.email}`);
  if (accountKey !== `email:${input.email}`) await clearFailures(db, accountKey);
  const token = await newSession(db, user.id, meta);
  await record(db, { type: 'user', id: user.id }, 'auth.login', { type: 'user', id: user.id });
  return { token, mfa: (user.totp_enabled_at ? 'verify' : 'enroll') as MfaState };
}

// ---------------- two-factor ----------------

const totpFor = (secret: OTPAuth.Secret, email: string) => new OTPAuth.TOTP({ issuer: 'Younes Tattoo', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret });

/** step one of enrolment: a new secret (stored encrypted, not yet active) and its QR code */
export async function startEnrollment(db: Executor, config: Config, auth: AuthContext) {
  if (auth.user.totp_enabled_at) throw conflict('Two-factor sign-in is already set up.');
  const secret = new OTPAuth.Secret({ size: 20 });
  await db.updateTable('users').set({ totp_secret_enc: encrypt(secret.base32, config.TOTP_ENC_KEY) }).where('id', '=', auth.user.id).execute();
  const uri = totpFor(secret, auth.user.email).toString();
  return { secret: secret.base32, uri, qrSvg: await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) };
}

/** a code for the user's secret, accepted once (no replay within its window); the step it matched, or null */
async function checkTotp(db: Executor, config: Config, userId: string, code: string): Promise<boolean> {
  const u = await db.selectFrom('users').select(['email', 'totp_secret_enc', 'totp_last_step']).where('id', '=', userId).executeTakeFirstOrThrow();
  if (!u.totp_secret_enc) return false;
  const totp = totpFor(OTPAuth.Secret.fromBase32(decrypt(u.totp_secret_enc, config.TOTP_ENC_KEY)), u.email);
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (u.totp_last_step !== null && step <= Number(u.totp_last_step)) return false;
  // claim the step atomically: two requests with one code can't both pass
  const r = await db
    .updateTable('users')
    .set({ totp_last_step: step })
    .where('id', '=', userId)
    .where((eb) => eb.or([eb('totp_last_step', 'is', null), eb('totp_last_step', '<', String(step))]))
    .executeTakeFirst();
  return Number(r.numUpdatedRows) === 1;
}

const RECOVERY_CODES = 10;
const recoveryCode = () => {
  const s = randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, 'x').slice(0, 12);
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
};

/** step two: the first code confirms the authenticator; recovery codes are shown once */
export async function confirmEnrollment(db: DB, config: Config, auth: AuthContext, code: string) {
  if (auth.user.totp_enabled_at) throw conflict('Two-factor sign-in is already set up.');
  return db.transaction().execute(async (tx) => {
    if (!/^\d{6}$/.test(code) || !(await checkTotp(tx, config, auth.user.id, code))) throw badRequest('That code didn’t match. Check the time on your phone and try the newest code.', { code: 'Code didn’t match' });
    await tx.updateTable('users').set({ totp_enabled_at: new Date() }).where('id', '=', auth.user.id).execute();
    await tx.deleteFrom('recovery_codes').where('user_id', '=', auth.user.id).execute();
    const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
    await tx.insertInto('recovery_codes').values(codes.map((c) => ({ user_id: auth.user.id, code_hash: sha256(c) }))).execute();
    const token = await rotate(tx, auth.session.id, true);
    await record(tx, { type: 'user', id: auth.user.id }, 'auth.mfa_enrolled', { type: 'user', id: auth.user.id });
    return { token, recoveryCodes: codes };
  });
}

/** the second step at sign-in: an authenticator code, or one recovery code (used up) */
export async function verifySecondStep(db: DB, config: Config, auth: AuthContext, code: string) {
  if (!auth.user.totp_enabled_at) throw conflict('Two-factor sign-in isn’t set up yet.');
  const key = `mfa:${auth.user.id}`;
  await checkLock(db, key);
  let ok = false;
  let usedRecovery = false;
  if (/^\d{6}$/.test(code)) ok = await checkTotp(db, config, auth.user.id, code);
  else {
    const r = await db
      .updateTable('recovery_codes')
      .set({ used_at: new Date() })
      .where('user_id', '=', auth.user.id)
      .where('code_hash', '=', sha256(code.toLowerCase()))
      .where('used_at', 'is', null)
      .executeTakeFirst();
    ok = usedRecovery = Number(r.numUpdatedRows) === 1;
  }
  if (!ok) {
    await fail(db, key);
    throw new AppError(401, 'invalid_code', 'That code didn’t match.');
  }
  await clearFailures(db, key);
  const token = await rotate(db, auth.session.id, true);
  const left = usedRecovery
    ? Number((await db.selectFrom('recovery_codes').select(sql<number>`count(*)::int`.as('n')).where('user_id', '=', auth.user.id).where('used_at', 'is', null).executeTakeFirstOrThrow()).n)
    : undefined;
  return { token, recoveryCodesLeft: left };
}

// ---------------- passwords ----------------

const RESET_MS = 30 * 60 * 1000;

/** always the same answer, whether or not the email has an account */
export async function requestPasswordReset(db: DB, config: Config, email: string) {
  const user = await db.selectFrom('users').select(['id', 'email']).where('email', '=', email).where('disabled_at', 'is', null).executeTakeFirst();
  if (!user) return;
  // at most 3 live requests: a flood can't fill a mailbox
  const live = await db.selectFrom('password_resets').select(sql<number>`count(*)::int`.as('n')).where('user_id', '=', user.id).where('used_at', 'is', null).where('expires_at', '>', new Date()).executeTakeFirstOrThrow();
  if (live.n >= 3) return;
  const token = randomToken();
  await db.transaction().execute(async (tx) => {
    await tx.insertInto('password_resets').values({ user_id: user.id, token_hash: sha256(token), expires_at: new Date(Date.now() + RESET_MS) }).execute();
    await enqueue(tx, { to: user.email, template: 'password-reset', payload: { link: `${config.PUBLIC_ORIGIN}/studio/reset?token=${encodeURIComponent(token)}` }, related: { type: 'user', id: user.id } });
  });
}

export async function resetPassword(db: DB, token: string, password: string) {
  return db.transaction().execute(async (tx) => {
    const reset = await tx
      .updateTable('password_resets')
      .set({ used_at: new Date() })
      .where('token_hash', '=', sha256(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date())
      .returning('user_id')
      .executeTakeFirst();
    if (!reset) throw badRequest('This reset link has expired or was already used. Ask for a new one.', { token: 'Expired or used' });
    const user = await tx
      .updateTable('users')
      .set({ password_hash: await hashPassword(password), password_changed_at: new Date() })
      .where('id', '=', reset.user_id)
      .returning('email')
      .executeTakeFirstOrThrow();
    // every session ends, every trusted browser is forgotten; a lockout from forgotten-password attempts is lifted
    await revokeAllSessions(tx, reset.user_id);
    await forgetDevices(tx, reset.user_id);
    await clearFailures(tx, `email:${user.email}`);
    await record(tx, { type: 'user', id: reset.user_id }, 'auth.password_reset', { type: 'user', id: reset.user_id });
  });
}

export async function changePassword(db: DB, auth: AuthContext, current: string, password: string) {
  const u = await db.selectFrom('users').select('password_hash').where('id', '=', auth.user.id).executeTakeFirstOrThrow();
  if (!(await verifyPassword(u.password_hash, current))) throw new AppError(400, 'validation', 'The current password isn’t right.', { current: 'Doesn’t match' });
  await db.transaction().execute(async (tx) => {
    await tx.updateTable('users').set({ password_hash: await hashPassword(password), password_changed_at: new Date() }).where('id', '=', auth.user.id).execute();
    // every other device is signed out
    await revokeAllSessions(tx, auth.user.id, auth.session.id);
    await record(tx, { type: 'user', id: auth.user.id }, 'auth.password_changed', { type: 'user', id: auth.user.id });
  });
}

export function requireAuth(auth: AuthContext | null): AuthContext {
  if (!auth) throw unauthenticated();
  return auth;
}
