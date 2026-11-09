import type { FastifyReply, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import { randomToken, sha256 } from '../../lib/crypto.ts';
import { AppError, badRequest, forbidden, unauthenticated } from '../../lib/errors.ts';
import { record } from '../audit/service.ts';
import { burnTime, hashPassword, verifyPassword } from '../auth/passwords.ts';
import { checkLock, clearFailures, fail } from '../auth/service.ts';
import { enqueue } from '../notify/service.ts';

/**
 * Client accounts - a separate world from the studio's users:
 *
 *   - their own table (client_accounts), sessions (client_sessions) and
 *     one-time links (client_tokens); a client's token is never looked up
 *     in the studio's tables or the other way round;
 *   - their own cookie, __Host-younes-client, read into `req.client` - the
 *     studio's routes read only `req.auth`, so no client session can ever
 *     pass a studio check;
 *   - no public way to create a studio account exists, here or anywhere.
 *
 * Registration never says whether an email already has an account: both
 * get the same answer, and the owner of the address gets the email (a
 * verification link for a new account, or a "you already have one" note).
 * An account reaches nothing until its email is verified; verifying links
 * it to the studio's record of that person (clients) - created then if
 * there is none - which is what every portal query is scoped to.
 */

export const CLIENT_COOKIE = '__Host-younes-client';
const IDLE_MS = 14 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
const TOUCH_MS = 5 * 60 * 1000;
const VERIFY_MS = 48 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;

export interface ClientContext {
  account: { id: string; name: string; email: string; verified: boolean; clientId: string | null };
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    client: ClientContext | null;
  }
}

export function setClientCookie(reply: FastifyReply, token: string) {
  reply.setCookie(CLIENT_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: ABSOLUTE_MS / 1000 });
}
export function clearClientCookie(reply: FastifyReply) {
  reply.clearCookie(CLIENT_COOKIE, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' });
}

/** the client behind a cookie token, renewing the idle expiry; null when there's none */
export async function clientFromToken(db: Executor, token: string | undefined): Promise<ClientContext | null> {
  if (!token || token.length > 100) return null;
  const now = new Date();
  const row = await db
    .selectFrom('client_sessions as s')
    .innerJoin('client_accounts as a', 'a.id', 's.account_id')
    .select(['s.id as session_id', 's.last_seen_at', 's.absolute_expires_at', 'a.id', 'a.name', 'a.email', 'a.email_verified_at', 'a.client_id'])
    .where('s.token_hash', '=', sha256(token))
    .where('s.revoked_at', 'is', null)
    .where('s.idle_expires_at', '>', now)
    .where('s.absolute_expires_at', '>', now)
    .where('a.disabled_at', 'is', null)
    .executeTakeFirst();
  if (!row) return null;
  if (now.getTime() - new Date(row.last_seen_at).getTime() > TOUCH_MS) {
    const idle = new Date(Math.min(now.getTime() + IDLE_MS, new Date(row.absolute_expires_at).getTime()));
    await db.updateTable('client_sessions').set({ last_seen_at: now, idle_expires_at: idle }).where('id', '=', row.session_id).execute();
  }
  return { account: { id: row.id, name: row.name, email: row.email, verified: !!row.email_verified_at, clientId: row.client_id }, sessionId: row.session_id };
}

/** a verified client with their record - or a 401/403. Every portal route behind sign-in calls this. */
export function requireClient(req: FastifyRequest): ClientContext & { account: { clientId: string } } {
  const c = req.client;
  if (!c) throw unauthenticated('Please sign in to your account.');
  if (!c.account.verified || !c.account.clientId) throw forbidden('Please verify your email address first - the link is in your inbox.');
  return c as ClientContext & { account: { clientId: string } };
}

async function newSession(db: Executor, accountId: string, userAgent?: string) {
  const token = randomToken();
  const now = Date.now();
  await db
    .insertInto('client_sessions')
    .values({ account_id: accountId, token_hash: sha256(token), idle_expires_at: new Date(now + IDLE_MS), absolute_expires_at: new Date(now + ABSOLUTE_MS), user_agent: userAgent?.slice(0, 300) ?? null })
    .execute();
  return token;
}

export const revokeClientSession = (db: Executor, id: string) =>
  db.updateTable('client_sessions').set({ revoked_at: new Date() }).where('id', '=', id).where('revoked_at', 'is', null).execute();

const revokeAll = (db: Executor, accountId: string, except?: string) => {
  let q = db.updateTable('client_sessions').set({ revoked_at: new Date() }).where('account_id', '=', accountId).where('revoked_at', 'is', null);
  if (except) q = q.where('id', '!=', except);
  return q.execute();
};

/** a fresh one-time link; at most 3 live ones per purpose, so a flood can't fill a mailbox */
async function issueToken(db: Executor, accountId: string, purpose: 'verify-email' | 'reset-password', ttl: number): Promise<string | null> {
  const live = await db
    .selectFrom('client_tokens')
    .select(sql<number>`count(*)::int`.as('n'))
    .where('account_id', '=', accountId)
    .where('purpose', '=', purpose)
    .where('used_at', 'is', null)
    .where('expires_at', '>', new Date())
    .executeTakeFirstOrThrow();
  if (live.n >= 3) return null;
  const token = randomToken();
  await db.insertInto('client_tokens').values({ account_id: accountId, purpose, token_hash: sha256(token), expires_at: new Date(Date.now() + ttl) }).execute();
  return token;
}

async function consumeToken(db: Executor, token: string, purpose: 'verify-email' | 'reset-password') {
  const row = await db
    .updateTable('client_tokens')
    .set({ used_at: new Date() })
    .where('token_hash', '=', sha256(token))
    .where('purpose', '=', purpose)
    .where('used_at', 'is', null)
    .where('expires_at', '>', new Date())
    .returning('account_id')
    .executeTakeFirst();
  return row?.account_id ?? null;
}

const verifyLink = (config: Config, token: string) => `${config.PUBLIC_ORIGIN}/account/verify?token=${encodeURIComponent(token)}`;

// ---------------- registration and verification ----------------

/** the same outcome for a new address and a known one; the address's owner gets the email */
export async function register(db: DB, config: Config, input: { name: string; email: string; password: string }) {
  const existing = await db.selectFrom('client_accounts').select(['id', 'email_verified_at']).where('email', '=', input.email).executeTakeFirst();
  if (existing) {
    // hash anyway, so a known address takes as long as a new one
    await burnTime(input.password);
    if (existing.email_verified_at) {
      await enqueue(db, { to: input.email, template: 'client-account-exists', payload: { signIn: `${config.PUBLIC_ORIGIN}/account`, reset: `${config.PUBLIC_ORIGIN}/account/forgot` }, related: { type: 'client-account', id: existing.id } });
    } else {
      await resendVerification(db, config, input.email);
    }
    return;
  }
  const passwordHash = await hashPassword(input.password);
  await db.transaction().execute(async (tx) => {
    const account = await tx
      .insertInto('client_accounts')
      .values({ email: input.email, name: input.name.trim(), password_hash: passwordHash })
      .onConflict((oc) => oc.column('email').doNothing())
      .returning('id')
      .executeTakeFirst();
    // two registrations racing for one address: the second quietly does nothing
    if (!account) return;
    const token = (await issueToken(tx, account.id, 'verify-email', VERIFY_MS))!;
    await enqueue(tx, { to: input.email, template: 'client-verify-email', payload: { name: input.name.trim(), link: verifyLink(config, token) }, related: { type: 'client-account', id: account.id } });
    await record(tx, { type: 'website' }, 'client_account.registered', { type: 'client-account', id: account.id });
  });
}

export async function resendVerification(db: DB, config: Config, email: string) {
  const a = await db.selectFrom('client_accounts').select(['id', 'name', 'email_verified_at']).where('email', '=', email).where('disabled_at', 'is', null).executeTakeFirst();
  if (!a || a.email_verified_at) return;
  await db.transaction().execute(async (tx) => {
    const token = await issueToken(tx, a.id, 'verify-email', VERIFY_MS);
    if (token) await enqueue(tx, { to: email, template: 'client-verify-email', payload: { name: a.name, link: verifyLink(config, token) }, related: { type: 'client-account', id: a.id } });
  });
}

/**
 * The link from the email: the address is theirs. The account is linked to
 * the studio's record of that person - an existing one with this email
 * (which no other account has claimed), or a new one - and signed in.
 */
export async function verifyEmail(db: DB, token: string, userAgent?: string) {
  return db.transaction().execute(async (tx) => {
    const accountId = await consumeToken(tx, token, 'verify-email');
    if (!accountId) throw badRequest('This link has expired or was already used. Sign in to get a new one.', { token: 'Expired or used' });
    const a = await tx.selectFrom('client_accounts').selectAll().where('id', '=', accountId).forUpdate().executeTakeFirstOrThrow();
    if (a.disabled_at) throw badRequest('This account is closed.');
    let clientId = a.client_id;
    if (!clientId) clientId = await claimClientRecord(tx, { id: a.id, email: a.email, name: a.name });
    await tx.updateTable('client_accounts').set({ email_verified_at: a.email_verified_at ?? new Date(), client_id: clientId }).where('id', '=', a.id).execute();
    await record(tx, { type: 'website' }, 'client_account.verified', { type: 'client', id: clientId }, { account: a.id });
    return newSession(tx, a.id, userAgent);
  });
}

/**
 * The studio's record of the person behind a just-verified account. An
 * earlier record with exactly this email (stored and compared one way:
 * trimmed, NFC, lower case - citext) joins the account, with its earlier
 * inquiries, only when its ownership is beyond doubt:
 *
 *   - it isn't anonymised, and no other account has claimed it;
 *   - none of its inquiries was sent from another account.
 *
 * If anything is in doubt, nothing moves: the account gets a fresh record
 * of its own (with no email on it, so it can't collide with the earlier
 * one) and the earlier history stays where it is. Either way the history
 * log says what happened and why - ids and counts only.
 */
async function claimClientRecord(tx: Executor, account: { id: string; email: string; name: string }) {
  const known = await tx.selectFrom('clients').select(['id']).where('email', '=', account.email).where('anonymized_at', 'is', null).execute();
  let reason: string | null = null;
  if (known.length > 1) reason = 'several-records';
  const candidate = known.length === 1 ? known[0] : undefined;
  if (candidate && !reason) {
    const claimed = await tx.selectFrom('client_accounts').select('id').where('client_id', '=', candidate.id).where('id', '!=', account.id).executeTakeFirst();
    const foreign = await tx
      .selectFrom('inquiries')
      .select('id')
      .where('client_id', '=', candidate.id)
      .where('account_id', 'is not', null)
      .where('account_id', '!=', account.id)
      .executeTakeFirst();
    if (claimed) reason = 'claimed-by-another-account';
    else if (foreign) reason = 'inquiry-from-another-account';
  }
  if (candidate && !reason) {
    const moved = await tx.updateTable('inquiries').set({ account_id: account.id }).where('client_id', '=', candidate.id).where('account_id', 'is', null).executeTakeFirst();
    await record(tx, { type: 'website' }, 'client_account.linked', { type: 'client', id: candidate.id }, { account: account.id, inquiries: Number(moved.numUpdatedRows) });
    return candidate.id;
  }
  const fresh = await tx
    .insertInto('clients')
    .values({ name: account.name, email: reason ? null : account.email })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (reason) await record(tx, { type: 'website' }, 'client_account.link_skipped', { type: 'client', id: fresh.id }, { account: account.id, reason, earlier: candidate?.id ?? null });
  return fresh.id;
}

// ---------------- sign-in ----------------

export async function login(db: DB, input: { email: string; password: string }, meta: { ip: string; userAgent?: string }) {
  const accountKey = `client-email:${input.email}`;
  const ipKey = `client-ip:${meta.ip}`;
  await checkLock(db, accountKey);
  await checkLock(db, ipKey);
  const a = await db.selectFrom('client_accounts').selectAll().where('email', '=', input.email).where('disabled_at', 'is', null).executeTakeFirst();
  const ok = a ? await verifyPassword(a.password_hash, input.password) : (await burnTime(input.password), false);
  if (!a || !ok) {
    await fail(db, accountKey);
    await fail(db, ipKey);
    throw new AppError(401, 'invalid_credentials', 'That email and password don’t match.');
  }
  await clearFailures(db, accountKey);
  // the right password, but the address isn't confirmed yet: nothing opens until it is
  if (!a.email_verified_at) throw new AppError(403, 'email_unverified', 'Please confirm your email address first - we sent you a link. You can ask for a new one below.');
  return newSession(db, a.id, meta.userAgent);
}

// ---------------- passwords ----------------

export async function requestReset(db: DB, config: Config, email: string) {
  const a = await db.selectFrom('client_accounts').select(['id']).where('email', '=', email).where('disabled_at', 'is', null).executeTakeFirst();
  if (!a) return;
  await db.transaction().execute(async (tx) => {
    const token = await issueToken(tx, a.id, 'reset-password', RESET_MS);
    if (token) await enqueue(tx, { to: email, template: 'client-password-reset', payload: { link: `${config.PUBLIC_ORIGIN}/account/reset?token=${encodeURIComponent(token)}` }, related: { type: 'client-account', id: a.id } });
  });
}

export async function resetPassword(db: DB, token: string, password: string) {
  const hash = await hashPassword(password);
  await db.transaction().execute(async (tx) => {
    const accountId = await consumeToken(tx, token, 'reset-password');
    if (!accountId) throw badRequest('This reset link has expired or was already used. Ask for a new one.', { token: 'Expired or used' });
    const a = await tx.updateTable('client_accounts').set({ password_hash: hash, password_changed_at: new Date() }).where('id', '=', accountId).returning('email').executeTakeFirstOrThrow();
    // every session ends; a lockout from forgotten-password attempts is lifted
    await revokeAll(tx, accountId);
    await clearFailures(tx, `client-email:${a.email}`);
    await record(tx, { type: 'website' }, 'client_account.password_reset', { type: 'client-account', id: accountId });
  });
}

export async function changePassword(db: DB, c: ClientContext, current: string, password: string) {
  const a = await db.selectFrom('client_accounts').select('password_hash').where('id', '=', c.account.id).executeTakeFirstOrThrow();
  if (!(await verifyPassword(a.password_hash, current))) throw new AppError(400, 'validation', 'The current password isn’t right.', { current: 'Doesn’t match' });
  const hash = await hashPassword(password);
  await db.transaction().execute(async (tx) => {
    await tx.updateTable('client_accounts').set({ password_hash: hash, password_changed_at: new Date() }).where('id', '=', c.account.id).execute();
    // every other device is signed out
    await revokeAll(tx, c.account.id, c.sessionId);
  });
}
