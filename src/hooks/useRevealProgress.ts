import { useEffect, type RefObject } from 'react';

interface Options {
  /** skip entirely (reduced motion): the variable stays unset and CSS shows everything */
  disabled?: boolean;
  /** CSS custom property written onto the element (default `--reveal`) */
  varName?: string;
}

/**
 * How far an element has moved through the reading area, 0 -> 1, written as
 * a CSS variable: 0 as its top enters the lower part of the screen (90% of
 * the viewport down), 1 once its bottom has risen to 65% of the viewport - so
 * a block is fully revealed while it is still comfortably in view.
 *
 * Progress follows position, not time: a fast scroll or a page loaded
 * already scrolled lands on the right state at once. The passive scroll
 * listener exists only while the element is on screen (IntersectionObserver),
 * and frames are coalesced with requestAnimationFrame.
 */
export function useRevealProgress<T extends HTMLElement>(ref: RefObject<T | null>, { disabled = false, varName = '--reveal' }: Options = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    let raf = 0;
    let last = -1;

    const update = () => {
      raf = 0;
      const vh = innerHeight;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.25 + r.height)));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      el.style.setProperty(varName, p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('resize', onScroll, { passive: true });
        update();
      } else {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
        // leaving the screen: settle on the side it left by
        update();
      }
    };
    const io = new IntersectionObserver(([e]) => listen(e.isIntersecting));
    io.observe(el);
    update();

    return () => {
      io.disconnect();
      listen(false);
      cancelAnimationFrame(raf);
      el.style.removeProperty(varName);
    };
  }, [ref, disabled, varName]);
}
