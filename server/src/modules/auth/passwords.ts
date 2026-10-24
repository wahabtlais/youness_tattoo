import { hash, verify } from '@node-rs/argon2';

/**
 * Passwords: Argon2id with OWASP's recommended minimum (19 MiB, 2
 * iterations, 1 lane) - slow for an attacker, fast enough for one sign-in.
 */
const OPTIONS = { algorithm: 2 /* Algorithm.Argon2id - a const enum, unreadable under verbatimModuleSyntax */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(stored: string, password: string) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// checked when the account doesn't exist, so a wrong email takes as long as a wrong password
let dummy: string | undefined;
export async function burnTime(password: string) {
  dummy ??= await hashPassword('timing-equaliser-not-a-real-password');
  await verifyPassword(dummy, password);
}
