import { z } from 'zod';

/**
 * Sign-in shapes. Passwords: at least 12 characters (length matters more
 * than mixtures), at most 128 so hashing can't be used to exhaust the
 * server.
 */
export const passwordSchema = z.string().min(12, 'Use at least 12 characters').max(128, 'At most 128 characters');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});

export const setupOwnerSchema = z.object({
  setupToken: z.string().min(16).max(200),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: passwordSchema,
});

/** a six-digit authenticator code, or one of the recovery codes (xxxx-xxxx-xxxx) */
export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().regex(/^(\d{6}|[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/i, 'Enter the 6-digit code or a recovery code')),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ current: z.string().min(1).max(128), password: passwordSchema });

/** where the visitor stands with signing in - what the dashboard shows next */
export const authStateSchema = z.object({
  /** no owner exists yet: the setup page (which also needs the server's setup token) */
  setupRequired: z.boolean(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(['owner', 'staff']) }).nullable(),
  /** signed in, but the second step isn't done: 'enroll' the first time, 'verify' after */
  mfa: z.enum(['none', 'enroll', 'verify', 'ok']),
});
export type AuthState = z.infer<typeof authStateSchema>;
