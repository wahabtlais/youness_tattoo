import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as OTPAuth from 'otpauth';
import { sql } from 'kysely';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.ts';
import { loadConfig, loadEnvFiles, type Config } from '../src/config.ts';
import { createDb, type DB } from '../src/db/index.ts';
import { diskStorage, type Storage } from '../src/lib/storage.ts';
import type { AiClient } from '../src/modules/ai/openrouter.ts';
import { createOwner } from '../src/modules/auth/service.ts';
import { invalidatePublic } from '../src/modules/content/service.ts';
import type { Mailer } from '../src/modules/notify/service.ts';

export const ORIGIN = 'http://localhost:5201';
/** what the studio's own pages send with every state-changing request */
export const STUDIO = { origin: ORIGIN, 'x-requested-with': 'younes-studio' };
export const SETUP_TOKEN = 'test-setup-token-0123456789abcdef';
export const OWNER = { name: 'Younes', email: 'owner@example.test', password: 'a long test password 123' };

export interface Ctx {
  app: FastifyInstance;
  db: DB;
  admin: DB;
  config: Config;
  storage: Storage;
  storageDir: string;
  mails: { to: string; subject: string; text: string }[];
  mailer: Mailer & { failing: boolean };
  close(): Promise<void>;
}

/** the real app on the test database - a capturing mailer, a temp storage folder, the AI client given (or none) */
export async function makeCtx(opts: { ai?: AiClient | null; env?: Record<string, string> } = {}): Promise<Ctx> {
  loadEnvFiles();
  const storageDir = await mkdtemp(path.join(tmpdir(), 'younes-test-'));
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    MIGRATION_DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL,
    STORAGE_DIR: storageDir,
    OWNER_SETUP_TOKEN: SETUP_TOKEN,
    PUBLIC_ORIGIN: ORIGIN,
    WORKER_ENABLED: 'false',
    SERVE_SITE: 'false',
    AI_ENABLED: 'false',
    RATE_LIMITS: 'false',
    // the full sign-in, whatever server/.env says (two-factor-off.test.ts covers off)
    TWO_FACTOR: 'true',
    ...opts.env,
  });
  const db = createDb(config.DATABASE_URL, { max: 8, applicationName: 'younes-test' });
  const admin = createDb(config.MIGRATION_DATABASE_URL, { max: 1, applicationName: 'younes-test-admin' });
  const mails: Ctx['mails'] = [];
  const mailer = {
    failing: false,
    async send(m: { to: string; subject: string; text: string }) {
      if (mailer.failing) throw new Error('SMTP connection refused (test)');
      mails.push(m);
    },
  };
  const storage = diskStorage(storageDir);
  const app = await buildApp({ db, config, storage, mailer, ai: opts.ai ?? null, now: () => new Date() });
  return {
    app,
    db,
    admin,
    config,
    storage,
    storageDir,
    mails,
    mailer,
    async close() {
      await app.close();
      await db.destroy();
      await admin.destroy();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}

/** every table emptied (by the schema owner), the settings row restored */
export async function resetDb(ctx: Ctx) {
  const tables = await sql<{ tablename: string }>`select tablename from pg_tables where schemaname = 'public' and tablename not like 'kysely_%'`.execute(ctx.admin);
  await sql`truncate ${sql.join(tables.rows.map((t) => sql.id(t.tablename)))} restart identity cascade`.execute(ctx.admin);
  await sql`insert into studio_settings default values`.execute(ctx.admin);
  invalidatePublic();
}

export function cookieOf(res: LightMyRequestResponse, name: string): string | undefined {
  const c = res.cookies.find((x) => x.name === name);
  return c ? `${c.name}=${c.value}` : undefined;
}

export const totpCode = (secret: string, offsetSteps = 0) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });

/**
 * Tests that reason about "this code" and "the next code" need the 30-second
 * window not to roll over halfway: if less than 10 seconds of the current
 * one are left, wait for the next to begin.
 */
export async function freshTotpWindow() {
  const left = 30_000 - (Date.now() % 30_000);
  if (left < 10_000) await new Promise((r) => setTimeout(r, left + 50));
}

/** the owner, signed in fully (password + authenticator enrolled): a cookie header for the studio */
export async function signIn(ctx: Ctx): Promise<{ cookie: string; secret: string; recoveryCodes: string[]; device: string }> {
  await freshTotpWindow();
  await createOwner(ctx.db, OWNER);
  const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', headers: STUDIO, payload: { email: OWNER.email, password: OWNER.password } });
  if (login.statusCode !== 200) throw new Error(`login failed: ${login.body}`);
  let cookie = cookieOf(login, ctx.config.cookieName)!;
  const enroll = await ctx.app.inject({ method: 'POST', url: '/api/auth/mfa/enroll', headers: { ...STUDIO, cookie } });
  const { secret } = enroll.json();
  const confirm = await ctx.app.inject({ method: 'POST', url: '/api/auth/mfa/enroll/confirm', headers: { ...STUDIO, cookie }, payload: { code: totpCode(secret) } });
  if (confirm.statusCode !== 200) throw new Error(`enrol failed: ${confirm.body}`);
  cookie = cookieOf(confirm, ctx.config.cookieName)!;
  // the browser is now a trusted one (its own cookie, read only at sign-in)
  const device = cookieOf(confirm, '__Host-younes-device')!;
  return { cookie, secret, recoveryCodes: confirm.json().recoveryCodes, device };
}

/** a valid consultation, as the website sends it */
export function consultation(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    entry: { from: 'find-similar', workId: '04', selection: { drawnTo: ['style'], references: ['08'] } },
    summary: { concept: 'A lion with a crown', meaning: 'For my father', bodyArea: 'forearm', scale: 'large', timing: 'months' },
    contact: { name: 'Test Client', email: 'client@example.test', phone: '+1 313 555 0100', instagram: '@test.client' },
    consent: true,
    privacyNoticeVersion: '2026-10-draft',
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    ...over,
  };
}
