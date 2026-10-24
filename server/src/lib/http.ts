import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.ts';
import type { DB } from '../db/index.ts';
import type { AuthContext } from '../modules/auth/service.ts';
import { mfaState } from '../modules/auth/service.ts';
import { forbidden, unauthenticated } from './errors.ts';
import type { Storage } from './storage.ts';
import type { Mailer } from '../modules/notify/service.ts';
import type { AiClient } from '../modules/ai/openrouter.ts';

/** what every module's routes are given */
export interface Deps {
  db: DB;
  config: Config;
  storage: Storage;
  mailer: Mailer;
  ai: AiClient | null;
  /** a fixed clock for tests; Date.now otherwise */
  now: () => Date;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    routeList: { method: string; url: string }[];
  }
}

// ---------------- the session cookie ----------------

export function setSessionCookie(reply: FastifyReply, config: Config, token: string) {
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    // __Host- requires Secure, path "/" and no Domain; browsers accept Secure on http://localhost
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

/**
 * A trusted browser's token (modules/auth: trusted devices): set after a
 * full sign-in, read only at sign-in. Strict - it's never needed on a
 * request that starts on another site.
 */
export const DEVICE_COOKIE = '__Host-younes-device';

export function setDeviceCookie(reply: FastifyReply, token: string) {
  reply.setCookie(DEVICE_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 180 * 24 * 60 * 60 });
}

export function clearSessionCookie(reply: FastifyReply, config: Config) {
  reply.clearCookie(config.cookieName, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' });
}

// ---------------- who may do what ----------------

/**
 * The permission table: one place to read, and the only thing to extend
 * when staff accounts arrive. Today only the owner exists.
 */
const PERMISSIONS = {
  'studio:read': ['owner', 'staff'],
  'studio:write': ['owner', 'staff'],
  'content:publish': ['owner'],
  'settings:write': ['owner'],
  'ai:use': ['owner'],
} as const satisfies Record<string, readonly ('owner' | 'staff')[]>;
export type Permission = keyof typeof PERMISSIONS;

/** signed in, past the second step, and allowed - or a 401/403. Every studio route calls this. */
export function requireUser(req: FastifyRequest, permission: Permission = 'studio:read'): AuthContext {
  const a = req.auth;
  if (!a) throw unauthenticated();
  if (mfaState(a) !== 'ok') throw forbidden('Finish signing in with your authenticator first.');
  if (!(PERMISSIONS[permission] as readonly string[]).includes(a.user.role)) throw forbidden();
  return a;
}

/** the request's origin, from Origin or (failing that) Referer */
export function requestOrigin(req: FastifyRequest): string | null {
  const o = req.headers.origin;
  if (o && o !== 'null') return o;
  const r = req.headers.referer;
  if (!r) return null;
  try {
    return new URL(r).origin;
  } catch {
    return null;
  }
}
