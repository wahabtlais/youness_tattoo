import type { ApiProblem } from '@younes/contracts';

/**
 * The studio's way to its API: same origin (the session cookie travels by
 * itself, HttpOnly - this code never sees it), JSON in and out, and the
 * header that marks a request as the studio's own (part of the server's
 * cross-site request forgery check). A failed request becomes an ApiError
 * carrying the server's message and per-field problems for forms.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  constructor(p: ApiProblem) {
    super(p.title);
    this.status = p.status;
    this.code = p.code;
    this.fields = p.fields ?? {};
  }
}

/** told when a request finds the session gone - the layout shows the sign-in again */
let onSignedOut: (() => void) | null = null;
export const whenSignedOut = (f: (() => void) | null) => {
  onSignedOut = f;
};

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'younes-studio' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
      headers,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError({ status: 0, code: 'offline', title: 'The studio’s server can’t be reached. Check that it’s running, then try again.' });
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const problem: ApiProblem = body && typeof body === 'object' && 'title' in body ? (body as ApiProblem) : { status: res.status, code: 'error', title: `The request failed (${res.status}).` };
    if (res.status === 401 && !path.startsWith('/api/auth/')) onSignedOut?.();
    throw new ApiError(problem);
  }
  return body as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
