import type { z } from 'zod';

/**
 * The one error every module throws for an expected failure. The error
 * handler turns it into application/problem+json with its status and
 * stable code; anything else becomes a 500 with no detail leaked.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new AppError(400, 'validation', message, fields);
export const unauthenticated = (message = 'Please sign in.') => new AppError(401, 'unauthenticated', message);
export const forbidden = (message = 'You don’t have access to this.') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new AppError(409, code, message);
export const tooMany = (message = 'Too many attempts. Please wait a little and try again.') => new AppError(429, 'rate_limited', message);
export const unavailable = (message: string, code = 'unavailable') => new AppError(503, code, message);

/** parse input with a schema, or a 400 naming each field's problem */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest('Some of the details need another look.', fields);
}
