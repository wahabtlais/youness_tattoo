import { useEffect } from 'react';

const SITE = 'Younes Tattoo';

/** the tab's title for an inner page ("Journal — Younes Tattoo"); restored when the page leaves */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} — ${SITE}`;
    return () => {
      document.title = before;
    };
  }, [title]);
}
