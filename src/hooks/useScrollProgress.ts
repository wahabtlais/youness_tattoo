import { useEffect, useRef, type RefObject } from 'react';

interface UseScrollProgressOptions {
  /** CSS custom property written onto the element (default `--p`) */
  varName?: string;
  /** fraction of the element's height that maps to progress 0 -> 1 (default 1) */
  distance?: number;
  /** skip entirely, leaving the property unset so CSS falls back to its default */
  disabled?: boolean;
  onProgress?: (p: number) => void;
}

/**
 * How far an element has scrolled past the top of the viewport, 0 -> 1,
 * written as a CSS variable so styles can derive every transform from one
 * number. Plain passive scroll listener + rAF; no scroll-hijacking, normal
 * document flow keeps driving the scroll itself.
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { varName = '--p', distance = 1, disabled = false, onProgress }: UseScrollProgressOptions = {}
) {
  const cbRef = useRef(onProgress);
  useEffect(() => {
    cbRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    let raf = 0;
    let last = -1;
    function update() {
      raf = 0;
      const rect = el!.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height * distance)));
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      el!.style.setProperty(varName, p.toFixed(4));
      cbRef.current?.(p);
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      el.style.removeProperty(varName);
    };
  }, [ref, varName, distance, disabled]);
}
