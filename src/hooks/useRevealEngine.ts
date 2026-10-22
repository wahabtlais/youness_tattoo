import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * A layer that drifts against the pointer. x/y are the max offset in px at
 * the viewport edge; different values per layer give the parallax depth.
 */
export interface ParallaxLayer {
  ref: RefObject<HTMLElement | null>;
  x: number;
  y: number;
}

interface UseRevealEngineArgs {
  /** the masked reveal plate - receives --mx / --my / --r */
  plateRef: RefObject<HTMLElement | null>;
  /** layers that drift against the pointer, e.g. the portrait and type planes */
  parallaxLayers: ParallaxLayer[];
  /** spotlight radius (px min/max, fraction of viewport width) */
  radius: { min: number; max: number; vw: number };
  cursorRef: RefObject<HTMLElement | null>;
  /** the hero itself: the cursor ring shows only while the pointer is over it */
  areaRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}

/**
 * Easing, as time constants (ms to close ~63% of the gap), so it feels the
 * same at 60Hz and 120Hz. The loupe follows closely (it IS the cursor's
 * reveal): 40ms, measured against the old ~130ms, trails a fast sweep by
 * about a third as much while still gliding over two or three frames. The
 * parallax planes keep their original slow drift (the old 0.12-per-frame
 * at 60Hz is ~130ms).
 */
const SPOT_TAU = 40;
const PARALLAX_TAU = 130;
/** close enough to the pointer to stop drawing (px) */
const SETTLED = 0.15;

/**
 * The hero's pointer work, in one rAF loop that runs only while something
 * moves: an eased pointer position feeds the reveal loupe (--mx / --my on the
 * plate) and the parallax planes; the cursor ring follows the pointer itself.
 * The loop starts on pointer movement, scrolling or resizing, and stops once
 * everything has settled - an idle hero costs nothing. Values are written
 * only when they change. Touch has no hover, so the loupe drifts on its own
 * until the first touch (that drift is the one thing that keeps running).
 *
 * The cursor ring is shown only for a mouse or pen over the hero (`areaRef`),
 * and hidden the moment the pointer leaves it - including when scrolling
 * carries the hero away under a still pointer. The system cursor is never
 * hidden anywhere.
 */
export function useRevealEngine({
  plateRef,
  parallaxLayers,
  radius,
  cursorRef,
  areaRef,
  reducedMotion,
}: UseRevealEngineArgs): { isFinePointer: boolean } {
  const [isFinePointer, setIsFinePointer] = useState(false);

  // read through a ref inside the rAF loop so callers can pass a fresh array
  // each render without restarting the engine
  const layersRef = useRef(parallaxLayers);
  useEffect(() => {
    layersRef.current = parallaxLayers;
  });

  useEffect(() => {
    // any fine pointer (a mouse on a touch laptop counts): the ring may be needed
    setIsFinePointer(matchMedia('(any-pointer: fine)').matches);
    const coarse = matchMedia('(pointer: coarse)').matches;

    const M = { x: innerWidth * 0.62, y: innerHeight * 0.45, sx: 0, sy: 0, px: 0, py: 0, has: false };
    M.sx = M.px = M.x;
    M.sy = M.py = M.y;
    /** last pointer, for re-checking the ring when the page scrolls under it */
    let pointer: { x: number; y: number; mouse: boolean } | null = null;
    let ringShown = false;
    let lastSpot = '';
    let lastLayers = '';

    function sizeMask() {
      const r = Math.round(Math.min(radius.max, Math.max(radius.min, innerWidth * radius.vw)));
      plateRef.current?.style.setProperty('--r', r + 'px');
    }

    // ---- the cursor ring: over the hero only, mouse/pen only ----
    function placeRing() {
      const ring = cursorRef.current;
      if (!ring) return;
      let show = false;
      if (pointer?.mouse) {
        const a = areaRef.current?.getBoundingClientRect();
        show = !!a && pointer.x >= a.left && pointer.x <= a.right && pointer.y >= a.top && pointer.y <= a.bottom;
      }
      if (show) ring.style.transform = `translate3d(${pointer!.x}px,${pointer!.y}px,0)`;
      if (show !== ringShown) {
        ringShown = show;
        ring.style.opacity = show ? '1' : '0';
      }
    }

    // ---- the loop ----
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let movingUntil = 0;
    const t0 = performance.now();
    const drifting = () => coarse && !M.has && !reducedMotion;

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(64, now - (last || now - 16.7));
      last = now;

      if (drifting()) {
        const t = (now - t0) / 1000;
        M.x = innerWidth * (0.5 + 0.3 * Math.sin(t * 0.42));
        M.y = innerHeight * (0.46 + 0.2 * Math.sin(t * 0.63 + 1.1));
      }
      const ks = 1 - Math.exp(-dt / SPOT_TAU);
      const kp = 1 - Math.exp(-dt / PARALLAX_TAU);
      M.sx += (M.x - M.sx) * ks;
      M.sy += (M.y - M.sy) * ks;
      M.px += (M.x - M.px) * kp;
      M.py += (M.y - M.py) * kp;

      const plate = plateRef.current;
      if (plate) {
        // the plate moves with the page: its box is read once per frame, before any write
        const box = plate.getBoundingClientRect();
        const spot = `${(M.sx - box.left).toFixed(1)}|${(M.sy - box.top).toFixed(1)}`;
        if (spot !== lastSpot) {
          lastSpot = spot;
          const [mx, my] = spot.split('|');
          plate.style.setProperty('--mx', mx + 'px');
          plate.style.setProperty('--my', my + 'px');
        }
      }

      if (!reducedMotion) {
        const px = M.px / innerWidth - 0.5;
        const py = M.py / innerHeight - 0.5;
        const key = `${px.toFixed(4)}|${py.toFixed(4)}`;
        if (key !== lastLayers) {
          lastLayers = key;
          for (const layer of layersRef.current) {
            if (layer.ref.current) {
              layer.ref.current.style.transform = `translate3d(${(-px * layer.x).toFixed(2)}px,${(-py * layer.y).toFixed(2)}px,0)`;
            }
          }
        }
      }

      const settled =
        Math.abs(M.x - M.sx) < SETTLED &&
        Math.abs(M.y - M.sy) < SETTLED &&
        Math.abs(M.x - M.px) < SETTLED &&
        Math.abs(M.y - M.py) < SETTLED;
      if (drifting() || !settled || now < movingUntil) wake();
      else last = 0;
    }
    function wake() {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    /** keep drawing a little after an event, while the page or the planes settle */
    function nudge(ms: number) {
      movingUntil = Math.max(movingUntil, performance.now() + ms);
      wake();
    }

    function onPointerMove(e: PointerEvent) {
      M.x = e.clientX;
      M.y = e.clientY;
      M.has = true;
      pointer = { x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' || e.pointerType === 'pen' };
      placeRing();
      wake();
    }
    function onPointerDown(e: PointerEvent) {
      M.has = true;
      M.x = e.clientX;
      M.y = e.clientY;
      wake();
    }
    function onScroll() {
      // the plate (and the hero under a still pointer) moved
      placeRing();
      nudge(120);
    }
    function onResize() {
      sizeMask();
      nudge(120);
    }
    function onLeaveWindow() {
      pointer = null;
      placeRing();
    }

    sizeMask();
    addEventListener('resize', onResize, { passive: true });
    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    if (coarse) addEventListener('pointerdown', onPointerDown, { passive: true });

    // only while the plate is on screen and the tab is visible - the
    // gallery below shouldn't pay for the hero
    function sync() {
      if (onScreen && !document.hidden) nudge(0);
      else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    if (plateRef.current) io.observe(plateRef.current);
    document.addEventListener('visibilitychange', sync);
    nudge(0);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      if (coarse) removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return { isFinePointer };
}
