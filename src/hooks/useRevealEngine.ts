import { useEffect, useRef, useState, type RefObject } from 'react';
import { ZONES, findZone, type RevealZone } from '../data/zones';

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
  inkRef: RefObject<HTMLElement | null>;
  /** V1 statue + gallery-wall layers (optional so other heroes can skip them) */
  figureParallaxRef?: RefObject<HTMLElement | null>;
  framesParallaxRef?: RefObject<HTMLElement | null>;
  /** any extra layers, e.g. Hero V2's portrait and type planes */
  parallaxLayers?: ParallaxLayer[];
  /** hit-test zones in fractions of the ink plate; defaults to the statue zones */
  zones?: RevealZone[];
  /** spotlight radius override (px min/max, fraction of viewport width) */
  radius?: { min: number; max: number; vw: number };
  cursorRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}

interface UseRevealEngineResult {
  activeZone: RevealZone | null;
  isFinePointer: boolean;
}

// Spotlight radius: small enough that discovering ink feels deliberate, not a
// floodlight. vw-based so it scales, clamped so it never vanishes on tiny
// screens or balloons on ultrawide ones.
const RADIUS_MIN = 42;
const RADIUS_MAX = 80;
const RADIUS_VW = 0.045;

const EASE = 0.12;
// "background frames: slightly more movement; angel: almost none" (brief step 11)
const FIGURE_PARALLAX = { x: 4, y: 3 };
const FRAMES_PARALLAX = { x: 16, y: 11 };

export function useRevealEngine({
  inkRef,
  figureParallaxRef,
  framesParallaxRef,
  parallaxLayers,
  zones = ZONES,
  radius,
  cursorRef,
  reducedMotion,
}: UseRevealEngineArgs): UseRevealEngineResult {
  const [activeZone, setActiveZone] = useState<RevealZone | null>(null);
  const [isFinePointer, setIsFinePointer] = useState(false);

  const zoneRef = useRef<RevealZone | null>(null);
  const radiusRef = useRef(60);
  // read through refs inside the rAF loop so callers can pass fresh arrays
  // each render without restarting the engine
  const layersRef = useRef(parallaxLayers);
  const zonesRef = useRef(zones);
  useEffect(() => {
    layersRef.current = parallaxLayers;
    zonesRef.current = zones;
  });

  useEffect(() => {
    setIsFinePointer(matchMedia('(pointer: fine)').matches);
    const coarse = matchMedia('(pointer: coarse)').matches;

    const M = { x: innerWidth * 0.62, y: innerHeight * 0.45, sx: 0, sy: 0, has: false };
    M.sx = M.x;
    M.sy = M.y;

    const R = radius ?? { min: RADIUS_MIN, max: RADIUS_MAX, vw: RADIUS_VW };
    function sizeMask() {
      radiusRef.current = Math.round(Math.min(R.max, Math.max(R.min, innerWidth * R.vw)));
      inkRef.current?.style.setProperty('--r', radiusRef.current + 'px');
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

      const inkEl = inkRef.current;
      if (inkEl) {
        const box = inkEl.getBoundingClientRect();
        inkEl.style.setProperty('--mx', (M.sx - box.left).toFixed(1) + 'px');
        inkEl.style.setProperty('--my', (M.sy - box.top).toFixed(1) + 'px');

        const u = (M.sx - box.left) / box.width;
        const v = (M.sy - box.top) / box.height;
        const hit = findZone(u, v, zonesRef.current);
        if (hit?.id !== zoneRef.current?.id) {
          zoneRef.current = hit;
          setActiveZone(hit);
        }
      }

      if (!reducedMotion) {
        const px = M.sx / innerWidth - 0.5;
        const py = M.sy / innerHeight - 0.5;
        if (figureParallaxRef?.current) {
          figureParallaxRef.current.style.transform =
            `translate3d(${(-px * FIGURE_PARALLAX.x).toFixed(2)}px,${(-py * FIGURE_PARALLAX.y).toFixed(2)}px,0)`;
        }
        if (framesParallaxRef?.current) {
          framesParallaxRef.current.style.transform =
            `translate3d(${(-px * FRAMES_PARALLAX.x).toFixed(2)}px,${(-py * FRAMES_PARALLAX.y).toFixed(2)}px,0)`;
        }
        const layers = layersRef.current;
        if (layers) {
          for (const layer of layers) {
            if (layer.ref.current) {
              layer.ref.current.style.transform =
                `translate3d(${(-px * layer.x).toFixed(2)}px,${(-py * layer.y).toFixed(2)}px,0)`;
            }
          }
        }
      }
    }
    raf = requestAnimationFrame(frame);

    function onVisibility() {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', sizeMask);
      removeEventListener('pointermove', onPointerMove);
      if (coarse) removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return { activeZone, isFinePointer };
}

export { ZONES };
