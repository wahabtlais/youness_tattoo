import { useSyncExternalStore } from 'react';

/**
 * How many ropes the portfolio hangs on at this width: three from 1000px,
 * two from 560px, one below - never so many that a tattoo becomes too small
 * to read. Follows the window through media queries (no resize listener,
 * no re-render until the count actually changes).
 */
const QUERIES = ['(min-width: 1000px)', '(min-width: 560px)'] as const;

function read(): 1 | 2 | 3 {
  if (typeof window === 'undefined') return 3;
  if (matchMedia(QUERIES[0]).matches) return 3;
  if (matchMedia(QUERIES[1]).matches) return 2;
  return 1;
}

function subscribe(onChange: () => void) {
  const lists = QUERIES.map((q) => matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

export function useRopeCount() {
  return useSyncExternalStore(subscribe, read, () => 3);
}
