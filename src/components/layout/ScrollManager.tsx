import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { pageOf } from './siteLinks';

/**
 * Scrolling between pages, which the router leaves to the app:
 * - arriving on another page (by a link) starts at its top;
 * - a link to a section (/#studio) scrolls to it, from any page - once the
 *   page has rendered it (a lazily loaded page may take a moment);
 * - moving within one page (a piece's detail over the archive, Find
 *   Similar, the consultation: search parameters) leaves the scroll alone;
 * - Back and Forward keep the browser's own restoration.
 */
export function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const how = useNavigationType();
  const page = pageOf(pathname);
  const last = useRef<{ page: string; hash: string } | null>(null);

  useEffect(() => {
    const before = last.current;
    last.current = { page, hash };
    if (!before || how === 'POP') return; // first load, Back/Forward: the browser places it
    const samePage = before.page === page;
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // within the page: the smooth scroll of the stylesheet. Arriving from
      // another page: straight there - and again while the page above it is
      // still settling (images, the hero's and the archive's measured
      // heights), unless the visitor has started scrolling themselves
      const behavior: ScrollBehavior = samePage ? 'smooth' : 'instant';
      let tries = 0;
      let raf = 0;
      const timers: number[] = [];
      let placed = -1;
      const place = () => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.scrollIntoView({ block: 'start', behavior });
        placed = scrollY;
        return true;
      };
      const find = () => {
        if (place()) {
          if (!samePage)
            for (const ms of [250, 600, 1200, 2000])
              timers.push(window.setTimeout(() => Math.abs(scrollY - placed) < 4 && place(), ms));
        } else if (tries++ < 90) raf = requestAnimationFrame(find);
      };
      find();
      return () => {
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
      };
    }
    if (!samePage) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page, hash, key, how]);

  return null;
}
