import { useCallback, useEffect, useState } from 'react';

/**
 * The studio's light / dark theme. A choice Younes makes is kept in this
 * browser (localStorage); until he makes one, it follows the operating
 * system - and keeps following it if the system setting changes. The <html>
 * element carries the theme while the studio is open (index.html sets it
 * before the first paint, so there is no flash), and drops it on leaving.
 */
export type StudioTheme = 'light' | 'dark';

/** shared with the inline script in index.html */
export const STUDIO_THEME_KEY = 'younes-studio-theme';

const QUERY = '(prefers-color-scheme: dark)';

function stored(): StudioTheme | null {
  try {
    const v = localStorage.getItem(STUDIO_THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const system = (): StudioTheme => (window.matchMedia?.(QUERY).matches ? 'dark' : 'light');

export function useStudioTheme() {
  const [choice, setChoice] = useState<StudioTheme | null>(stored);
  const [os, setOs] = useState<StudioTheme>(system);
  const theme = choice ?? os;

  // follow the system while there's no choice of his own
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const update = () => setOs(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.studioTheme = theme;
  }, [theme]);
  // leaving the studio: the public site never carries it
  useEffect(() => () => void delete document.documentElement.dataset.studioTheme, []);

  const toggle = useCallback(() => {
    const next: StudioTheme = theme === 'dark' ? 'light' : 'dark';
    setChoice(next);
    try {
      localStorage.setItem(STUDIO_THEME_KEY, next);
    } catch {
      // private mode: the choice lasts for the visit
    }
  }, [theme]);

  return { theme, toggle };
}
