import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The few cryptographic operations the API needs - all Node's own
 * (OpenSSL), none invented here:
 * - tokens: 32 random bytes, base64url; only their SHA-256 is stored, so a
 *   leaked table holds nothing usable (256-bit tokens need no slow hash);
 * - authenticator secrets: AES-256-GCM at rest, with TOTP_ENC_KEY.
 */

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest();
export const sha256hex = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encrypt(plain: string, keyB64: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function decrypt(sealed: string, keyB64: string) {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1') throw new Error('Unknown encryption version');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
}

/**
 * A visitor's address, keyed with a server secret and the day: the same
 * address on the same day matches (enough to notice abuse), but without the
 * secret it can't be recovered by trying every address. Never stored in the clear.
 */
export function ipHash(ip: string, secret: string, day = new Date().toISOString().slice(0, 10)) {
  return createHmac('sha256', `ip-hash:${secret}`).update(`${day}:${ip}`).digest('hex').slice(0, 32);
}

/** a receipt reference visitors can quote: YT- and 8 unambiguous characters */
export function publicRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return `YT-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}
