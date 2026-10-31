import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';

/**
 * One thing read from the studio's API, by its path: loaded when the path
 * is first used (or changes), and again on `reload()` - which resolves
 * once the fresh copy is in. While a new path loads, nothing of the old
 * one is shown. `path: null` reads nothing.
 */
export function useResource<T, R = T>(path: string | null, map?: (raw: R) => T) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });

  useEffect(() => {
    if (!path) return;
    let live = true;
    api<R>(path).then(
      (raw) => live && setState({ path, data: map ? map(raw) : (raw as unknown as T), error: null }),
      (e) => live && setState((s) => ({ path, data: s.path === path ? s.data : null, error: errorText(e) })),
    );
    return () => {
      live = false;
    };
    // `map` is a pure shape conversion; a new function each render isn't a new resource
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const raw = await api<R>(path);
      setState({ path, data: map ? map(raw) : (raw as unknown as T), error: null });
    } catch (e) {
      setState((s) => ({ ...s, error: errorText(e) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const current = state.path === path;
  return { data: current ? state.data : null, error: current ? state.error : null, reload };
}
