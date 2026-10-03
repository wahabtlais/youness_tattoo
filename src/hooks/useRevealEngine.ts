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
  reducedMotion: boolean;
}

const EASE = 0.12;

/**
 * One rAF loop for the hero's pointer work: an eased pointer position feeds
 * the reveal spotlight (--mx / --my on the plate), the cursor ring and the
 * parallax planes. Touch has no hover, so the spotlight drifts on its own
 * until the first touch.
 */
export function useRevealEngine({
  plateRef,
  parallaxLayers,
  radius,
  cursorRef,
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
    setIsFinePointer(matchMedia('(pointer: fine)').matches);
    const coarse = matchMedia('(pointer: coarse)').matches;

    const M = { x: innerWidth * 0.62, y: innerHeight * 0.45, sx: 0, sy: 0, has: false };
    M.sx = M.x;
    M.sy = M.y;

    function sizeMask() {
      const r = Math.round(Math.min(radius.max, Math.max(radius.min, innerWidth * radius.vw)));
      plateRef.current?.style.setProperty('--r', r + 'px');
    }
    sizeMask();
    addEventListener('resize', sizeMask);

    function onPointerMove(e: PointerEvent) {
      M.x = e.clientX;
      M.y = e.clientY;
      M.has = true;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      }
    }
    addEventListener('pointermove', onPointerMove, { passive: true });

    function onPointerDown(e: PointerEvent) {
      M.has = true;
      M.x = e.clientX;
      M.y = e.clientY;
    }
    if (coarse) addEventListener('pointerdown', onPointerDown, { passive: true });

    let raf = 0;
    const t0 = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);

      // touch has no hover - drift the spotlight until the first touch
      if (coarse && !M.has && !reducedMotion) {
        const t = (now - t0) / 1000;
        M.x = innerWidth * (0.5 + 0.3 * Math.sin(t * 0.42));
        M.y = innerHeight * (0.46 + 0.2 * Math.sin(t * 0.63 + 1.1));
      }

      M.sx += (M.x - M.sx) * EASE;
      M.sy += (M.y - M.sy) * EASE;

      const plate = plateRef.current;
      if (plate) {
        const box = plate.getBoundingClientRect();
        plate.style.setProperty('--mx', (M.sx - box.left).toFixed(1) + 'px');
        plate.style.setProperty('--my', (M.sy - box.top).toFixed(1) + 'px');
      }

      if (!reducedMotion) {
        const px = M.sx / innerWidth - 0.5;
        const py = M.sy / innerHeight - 0.5;
        for (const layer of layersRef.current) {
          if (layer.ref.current) {
            layer.ref.current.style.transform =
              `translate3d(${(-px * layer.x).toFixed(2)}px,${(-py * layer.y).toFixed(2)}px,0)`;
          }
        }
      }
    }
    // only run while the plate is on screen and the tab is visible - the
    // gallery below shouldn't pay for the hero
    let onScreen = true;
    function sync() {
      cancelAnimationFrame(raf);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    if (plateRef.current) io.observe(plateRef.current);
    sync();
    document.addEventListener('visibilitychange', sync);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', sizeMask);
      removeEventListener('pointermove', onPointerMove);
      if (coarse) removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return { isFinePointer };
}
