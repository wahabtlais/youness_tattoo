import { useEffect, type RefObject } from 'react';

/**
 * Keeps an element's CSS mask registered to another element's on-screen box.
 *
 * masks a copy of the YOUNES type with the portrait's own alpha, so
 * the letters read as printed through the photograph. The type and the
 * portrait move on different parallax / scroll planes, so the mask can't
 * simply be static: each frame we measure both boxes and place the mask in
 * the masked element's local (pre-transform) space. Assumes the masked
 * element only ever translates + scales uniformly, which is all does.
 *
 * Only runs while something can have moved it - the page scrolling, the
 * pointer moving (the planes drift against it) or a resize - and for a short
 * while after, as the eased planes settle; an idle hero costs nothing. Only
 * while `sectionRef` is on screen, and only writes when the numbers change.
 */
export function useRegisteredMask(
  maskedRefs: RefObject<HTMLElement | null>[],
  sourceRef: RefObject<HTMLElement | null>,
  sectionRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const masked = maskedRefs.map((r) => r.current).filter((el): el is HTMLElement => !!el);
    const source = sourceRef.current;
    const section = sectionRef.current;
    if (!masked.length || !source || !section) return;

    let raf = 0;
    let running = false;
    const lastKeys = new Map<HTMLElement, string>();
    let inView = false;
    /** keep measuring until then: the parallax planes ease for ~0.7s after the pointer stops */
    let until = 0;
    const SETTLE_MS = 900;

    function frame(now: number) {
      if (now > until) {
        running = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
      const s = source!.getBoundingClientRect();
      for (const el of masked) {
        const m = el.getBoundingClientRect();
        const localW = el.offsetWidth;
        if (!localW || !m.width) continue;
        const k = localW / m.width;

        const x = ((s.left - m.left) * k).toFixed(1);
        const y = ((s.top - m.top) * k).toFixed(1);
        const w = (s.width * k).toFixed(1);
        const h = (s.height * k).toFixed(1);
        const key = `${x} ${y} ${w} ${h}`;
        if (key === lastKeys.get(el)) continue;
        lastKeys.set(el, key);
        el.style.setProperty('--mask-pos', `${x}px ${y}px`);
        el.style.setProperty('--mask-size', `${w}px ${h}px`);
      }
    }

    function start() {
      until = performance.now() + SETTLE_MS;
      if (running || !inView || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !document.hidden) start();
      else stop();
    });
    io.observe(section);
    // what can move the planes: scrolling, the pointer, the window
    addEventListener('scroll', start, { passive: true });
    addEventListener('pointermove', start, { passive: true });
    addEventListener('resize', start, { passive: true });

    function onVisibility() {
      if (document.hidden) stop();
      else if (inView) start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io.disconnect();
      removeEventListener('scroll', start);
      removeEventListener('pointermove', start);
      removeEventListener('resize', start);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // refs are stable objects; the list is fixed for the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRef, sectionRef]);
}
