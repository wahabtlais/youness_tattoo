import { useEffect, useSyncExternalStore } from 'react';
import type { ClientSessionState } from '@younes/contracts';
import { clientApi } from './api';

/**
 * Who is signed in to a client account, for any page that needs to know -
 * the consultation (which needs an account to send), the masthead's
 * Account link, the portal. One small request, made the first time
 * something asks (never during the first paint), shared by everyone, and
 * refreshed after signing in or out.
 */

export type ClientSession = { status: 'loading' } | { status: 'ready'; account: ClientSessionState['account'] };

let state: ClientSession = { status: 'loading' };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: ClientSession) {
  state = next;
  for (const l of listeners) l();
}

/** ask the server again (after signing in, out, or verifying) */
export function refreshClientSession() {
  inflight = clientApi<ClientSessionState>('/session')
    .then((s) => set({ status: 'ready', account: s.account }))
    .catch(() => set({ status: 'ready', account: null }));
  return inflight;
}

export function useClientSession(): ClientSession {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!inflight) void refreshClientSession();
  }, []);
  return s;
}

/** signed in and verified: the account, or null */
export const signedIn = (s: ClientSession) => (s.status === 'ready' && s.account?.verified ? s.account : null);
