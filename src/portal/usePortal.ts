import { useCallback, useEffect, useState } from 'react';
import { STUDIO_TIME_ZONE } from '@younes/contracts';
import { clientApi, errorText } from '../client/api';

export type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/** one portal resource: loaded on mount, reloadable after a change */
export function usePortal<T>(path: string | null) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    const ctl = new AbortController();
    clientApi<T>(path, { signal: ctl.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setState({ status: 'error', message: errorText(e) });
      });
    return () => ctl.abort();
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return [state, reload] as const;
}

/**
 * An appointment's time as the studio keeps it: in Detroit (contracts:
 * studioTime) unless another zone is asked for explicitly - never the
 * browser's zone by default.
 */
export function when(iso: string, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timeZone ?? STUDIO_TIME_ZONE }).format(new Date(iso));
}
/** the visitor's own time zone, as their browser reports it */
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const dayLong = (iso: string, tz?: string) => when(iso, tz, { weekday: 'long', month: 'long', day: 'numeric' });
export const dayShort = (iso: string, tz?: string) => when(iso, tz, { month: 'short', day: 'numeric', year: 'numeric' });
export const time = (iso: string, tz?: string) => when(iso, tz, { hour: 'numeric', minute: '2-digit' });
/** "3 hours ago", "2 days ago" - for the recent list */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (s < 60) return 'just now';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return dayShort(iso);
}
