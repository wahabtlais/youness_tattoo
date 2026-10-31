import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * The server's configuration, from the environment, checked once at start.
 * Locally it is read from server/.env (written by `npm run setup`) and then
 * the repository's .env (which may hold OPENROUTER_API_KEY) - variables
 * already in the environment always win. Nothing here ever reaches the
 * browser, and nothing secret is logged.
 */

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

export function loadEnvFiles() {
  for (const file of [path.join(SERVER_ROOT, '.env'), path.join(REPO_ROOT, '.env')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  /** the runtime role: reads and writes data, can't change the schema */
  DATABASE_URL: z.string().url(),
  /** the schema owner: migrations only */
  MIGRATION_DATABASE_URL: z.string().url(),
  /** where the site is visited from: checked on every state-changing request, and used in emails */
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:5201'),
  /** further origins allowed to send state-changing requests (comma-separated) */
  EXTRA_ORIGINS: z.string().default(''),
  /** behind a reverse proxy that sets X-Forwarded-For */
  TRUST_PROXY: bool.default(false),
  /** per-address request limits on sign-in and the public form - always on outside tests */
  RATE_LIMITS: bool.default(true),
  STORAGE_DIR: z.string().default(path.join(REPO_ROOT, 'storage')),
  /** the built public site; served (with published content) when SERVE_SITE is on */
  SITE_DIST_DIR: z.string().default(path.join(REPO_ROOT, 'dist')),
  SERVE_SITE: bool,
  /** 32 random bytes, base64: encrypts authenticator secrets at rest */
  TOTP_ENC_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'TOTP_ENC_KEY must be 32 bytes, base64'),
  /**
   * the authenticator step at sign-in. Off: the password alone signs in, and
   * a session lasts a year. Turned back on, every session must pass the
   * second step again (none was marked as passed while it was off).
   */
  TWO_FACTOR: bool.default(true),
  /** lets the first owner be created from the browser; unset = command line only */
  OWNER_SETUP_TOKEN: z.string().min(24).optional(),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().default(51025),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Younes Tattoo <studio@localhost>'),
  /** the email worker: off in tests, which drive it by hand */
  WORKER_ENABLED: bool,
  AI_ENABLED: bool.default(false),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  AI_MODEL_DEFAULT: z.string().default('anthropic/claude-sonnet-4.5'),
  AI_MODEL_SUMMARY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
});

export type Config = z.infer<typeof schema> & {
  isProd: boolean;
  isTest: boolean;
  serveSite: boolean;
  workerEnabled: boolean;
  allowedOrigins: string[];
  aiConfigured: boolean;
  /** the cookie's name: __Host- prefixed (Secure, path /, no domain) */
  cookieName: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // name the problems, never the values
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`The server's configuration is incomplete:\n${problems}\nRun \`npm run setup\` for local development, or see server/README.md.`);
  }
  const c = parsed.data;
  const isProd = c.NODE_ENV === 'production';
  const isTest = c.NODE_ENV === 'test';
  if (isProd && !c.RATE_LIMITS) throw new Error('RATE_LIMITS can only be turned off in tests.');
  return {
    ...c,
    isProd,
    isTest,
    serveSite: c.SERVE_SITE ?? isProd,
    workerEnabled: c.WORKER_ENABLED ?? !isTest,
    allowedOrigins: [c.PUBLIC_ORIGIN, ...c.EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)].map((o) => new URL(o).origin),
    aiConfigured: !!(c.AI_ENABLED && c.OPENROUTER_API_KEY),
    cookieName: '__Host-younes-session',
  };
}
