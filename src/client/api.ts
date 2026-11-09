import type { ApiProblem } from '@younes/contracts';

/**
 * The client portal's way to its API (/api/client): same origin, the
 * client's own HttpOnly cookie travelling by itself (this code never sees
 * it), JSON in and out, and the header that marks a request as the
 * portal's own - the server's cross-site request forgery check, distinct
 * from the studio's. A failed request becomes a ClientApiError with the
 * server's message and per-field problems for forms.
 */
export class ClientApiError extends Error {
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

export async function clientApi<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'younes-client' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api/client${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
      headers,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ClientApiError({ status: 0, code: 'offline', title: 'We couldn’t reach the studio just now. Check your connection and try again.' });
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const problem: ApiProblem = body && typeof body === 'object' && 'title' in body ? (body as ApiProblem) : { status: res.status, code: 'error', title: 'Something went wrong. Please try again.' };
    throw new ClientApiError(problem);
  }
  return body as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
