import { useEffect, type RefObject } from 'react';

/**
 * Keeps an element's CSS mask registered to another element's on-screen box.
 *
 * Hero V2 masks a copy of the YOUNES type with the portrait's own alpha, so
 * the letters read as printed through the photograph. The type and the
 * portrait move on different parallax / scroll planes, so the mask can't
 * simply be static: each frame we measure both boxes and place the mask in
 * the masked element's local (pre-transform) space. Assumes the masked
 * element only ever translates + scales uniformly, which is all Hero V2 does.
 *
 * Only runs while `sectionRef` is on screen, and only writes when the
 * numbers actually change.
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

    function frame() {
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
      if (running) return;
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

    function onVisibility() {
      if (document.hidden) stop();
      else if (inView) start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // refs are stable objects; the list is fixed for the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRef, sectionRef]);
}
