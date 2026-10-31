import { useEffect, useSyncExternalStore } from 'react';
import type { AsyncState } from '../lib/async';
import { api } from './api';
import type { Overview } from './types';

/**
 * The studio's records as the dashboard reads them
 * (GET /api/studio/overview): inquiries, upcoming appointments, open
 * follow-ups and recent activity - the same shapes the pages were built
 * on, now from the database. One copy is shared by every page and fetched
 * once; after a change, `reloadOverview()` brings every page up to date.
 * Sample records carry `demo` and are labelled wherever they appear.
 */

type State = AsyncState<Overview>;
let state: State = { status: 'loading' };
let inflight: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function reloadOverview(): Promise<void> {
  inflight ??= api<Overview>('/api/studio/overview')
    .then((data) => {
      state = { status: 'success', data };
    })
    .catch((error: Error) => {
      // keep showing what we had if a refresh fails; say so only when there's nothing
      if (state.status !== 'success') state = { status: 'error', error, retry: () => void reloadOverview() };
    })
    .finally(() => {
      inflight = null;
      loaded = true;
      emit();
    });
  return inflight;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** `now` is kept for the pages' own date arithmetic; the records come from the server */
export function useOverview(_now?: Date): State {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!loaded && !inflight) void reloadOverview();
  }, []);
  return s;
}
