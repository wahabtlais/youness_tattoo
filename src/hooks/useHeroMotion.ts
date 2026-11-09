import { useEffect, useRef, type RefObject } from 'react';

/**
 * A layer that drifts against the pointer. x/y are the max offset in px at
 * the viewport edge; different values per layer give the parallax depth.
 */
export interface ParallaxLayer {
  ref: RefObject<HTMLElement | null>;
  x: number;
  y: number;
}

interface UseHeroMotionArgs {
  /** the hero: its box gives the scroll progress; work stops while it's off screen */
  stageRef: RefObject<HTMLElement | null>;
  /** layers that drift against a fine pointer, e.g. the portrait and type planes */
  layers: ParallaxLayer[];
  /**
   * Elements whose CSS mask (--mask-pos / --mask-size) must stay registered
   * to `source`'s on-screen box: the knock-out type, masked by the portrait.
   * Each names the index (in `layers`) of the parallax plane it rides on.
   */
  mask?: {
    source: RefObject<HTMLElement | null>;
    sourceLayer: number;
    masked: { ref: RefObject<HTMLElement | null>; layer: number }[];
  };
  /** elements nudged by a nearby pointer: get --near, --ax, --ay, --ar */
  reactiveSelector?: string;
  /** the index (in `layers`) of the parallax plane the reactive elements ride on */
  reactiveLayer?: number;
  reducedMotion: boolean;
  /** CSS variable for scroll progress on the stage (omit when nothing reads it) */
  progressVar?: string;
  /** called with progress 0..1 as the hero scrolls away - also with reduced motion */
  onProgress?: (p: number) => void;
}

/** ms to close ~63% of the gap: the planes' slow drift, the same at 60Hz and 120Hz */
const PARALLAX_TAU = 130;
/** close enough to the pointer to stop drawing (px) */
const SETTLED = 0.15;
/** keep drawing this long after a scroll or resize event (the page settling) */
const SCROLL_MS = 120;
/** pointer distance at which a reactive ink element starts to give (px) */
const REACT_PX = 240;

/**
 * The hero's pointer and scroll work, as ONE requestAnimationFrame loop that
 * runs only while something moves, and does all its reading before any
 * writing in each frame - so the browser lays the page out once per frame
 * instead of being forced to restyle the whole hero between interleaved
 * reads and writes (what three separate loops used to do).
 *
 * Each frame, only what changed:
 *   read   only after a scroll, resize or entrance: the hero's box (scroll
 *          progress) and the boxes of the mask source, the masked type and
 *          the reactive ink - never for the pointer
 *   ease   the parallax position toward the pointer
 *   write  parallax transforms, mask position/size, ink nudges, progress -
 *          each only when its value changed
 *
 * Between measurements the parallax is the only thing moving those boxes,
 * and it is a translation this loop writes itself: positions are the last
 * measurement plus how far each plane has moved since. So pointer frames
 * read no layout at all - a read would force the hero's running
 * animations to restyle before the frame's own restyle - and the masks
 * still stay in register.
 *
 * Events only record what happened and request a frame; nothing measures in
 * an event handler, and nothing touches React state. Off screen or in a
 * hidden tab the loop stops. Touch has no hover, so on coarse pointers the
 * planes simply rest (no autonomous drift loop). Reduced motion: no
 * parallax and no nudges, but the masks stay registered and the masthead
 * still learns the scroll position.
 */
export function useHeroMotion({ stageRef, layers, mask, reactiveSelector, reactiveLayer, reducedMotion, progressVar, onProgress }: UseHeroMotionArgs) {
  // read through refs inside the loop, so callers can pass fresh arrays and
  // callbacks each render without restarting it
  const config = useRef({ layers, mask, onProgress });
  useEffect(() => {
    config.current = { layers, mask, onProgress };
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fine = matchMedia('(pointer: fine)').matches;
    const parallax = fine && !reducedMotion;
    const reactive = parallax && reactiveSelector ? Array.from(stage.querySelectorAll<HTMLElement>(reactiveSelector)) : [];
    /** the planes as mounted: their transforms are cleared on the way out */
    const planes = config.current.layers.map((l) => l.ref.current);

    // pointer target and the eased position the planes follow (viewport px)
    const P = { tx: innerWidth / 2, ty: innerHeight / 2, x: innerWidth / 2, y: innerHeight / 2, cx: -1e4, cy: -1e4 };
    /** the offsets written last frame, per layer - what the page currently shows */
    let shown: { x: number; y: number }[] = [];
    let lastLayerKey = '';
    const lastMask = new Map<HTMLElement, string>();
    const lastInk = new Map<HTMLElement, string>();
    /** an ink element's nudge (--near, --ax, --ay, --ar), written only when it changed */
    function writeInk(el: HTMLElement, v: number[]) {
      const value = v.map((n) => n.toFixed(2)).join('|');
      if (value === lastInk.get(el)) return;
      lastInk.set(el, value);
      ['--near', '--ax', '--ay', '--ar'].forEach((name, i) => el.style.setProperty(name, v[i].toFixed(2)));
    }
    /** masked elements' untransformed widths (only change with the layout) */
    const widths = new Map<HTMLElement, number>();
    let lastProgress = -1;

    let raf = 0;
    let last = 0;
    let visible = true;
    let activeUntil = 0;
    let scrolled = true;
    /** measure the masks' and ink's boxes this frame (something other than the parallax moved them) */
    let measure = true;
    /**
     * the last measurement, and the plane offsets on screen when it was
     * taken: between measurements, positions are that plus how far each
     * plane has since been moved - pure arithmetic, no layout read
     */
    let base: {
      source: DOMRect | null;
      masked: { el: HTMLElement; layer: number; box: DOMRect }[];
      ink: DOMRect[];
      at: { x: number; y: number }[];
    } | null = null;
    let sized = false;
    let pointerMoved = false;
    let inkReset = false;

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(64, now - (last || now - 16.7));
      last = now;
      const { layers: L, mask: M, onProgress: report } = config.current;

      // ---- ease toward the pointer (pure arithmetic) ----
      if (parallax) {
        const k = 1 - Math.exp(-dt / PARALLAX_TAU);
        P.x += (P.tx - P.x) * k;
        P.y += (P.ty - P.y) * k;
      }
      const px = parallax ? P.x / innerWidth - 0.5 : 0;
      const py = parallax ? P.y / innerHeight - 0.5 : 0;
      const next = L.map((l) => ({ x: -px * l.x, y: -py * l.y }));
      if (shown.length !== next.length) shown = next.map(() => ({ x: 0, y: 0 }));
      const planesMoving = next.some((o, i) => Math.abs(o.x - shown[i].x) > 0.005 || Math.abs(o.y - shown[i].y) > 0.005);

      // ---- read: only when the scroll, a resize or an entrance moved things -
      // never for the pointer, whose parallax is accounted for below. (A read
      // here forces the hero's running animations to restyle before the
      // frame's own restyle: two per frame instead of one.) ----
      const stageBox = scrolled ? stage!.getBoundingClientRect() : null;
      const measured = measure;
      if (measure) {
        const source = M?.source.current ?? null;
        base = {
          source: source ? source.getBoundingClientRect() : null,
          masked: (M?.masked ?? []).flatMap(({ ref, layer }) => {
            const el = ref.current;
            if (!el) return [];
            if (!sized || !widths.has(el)) widths.set(el, el.offsetWidth);
            return [{ el, layer, box: el.getBoundingClientRect() }];
          }),
          ink: reactive.map((el) => el.getBoundingClientRect()),
          at: shown.map((o) => ({ ...o })),
        };
        sized = true;
      }
      /** how far plane `i` has moved since the measurement */
      const moved = (i: number) => ({ x: next[i].x - (base?.at[i]?.x ?? 0), y: next[i].y - (base?.at[i]?.y ?? 0) });

      // ---- write ----
      if (parallax) {
        const key = next.map((o) => `${o.x.toFixed(2)},${o.y.toFixed(2)}`).join('|');
        if (key !== lastLayerKey) {
          lastLayerKey = key;
          L.forEach((l, i) => {
            const el = l.ref.current;
            if (el) el.style.transform = `translate3d(${next[i].x.toFixed(2)}px,${next[i].y.toFixed(2)}px,0)`;
          });
        }
      }

      const sourceBox = base?.source;
      if (M && sourceBox && (measured || planesMoving)) {
        // the source and each masked plane, where the parallax puts them this frame
        const ds = moved(M.sourceLayer);
        for (const { el, layer, box } of base!.masked) {
          const localW = widths.get(el) ?? 0;
          if (!localW || !box.width) continue;
          const k = localW / box.width;
          const dm = moved(layer);
          // whole pixels: the planes' parallax differs by a few px at most, so
          // the mask stays within half a pixel of the portrait while being
          // rewritten only when it crosses a pixel - each rewrite restyles
          // and repaints the giant masked word, so not every frame
          const x = Math.round((sourceBox.left + ds.x - (box.left + dm.x)) * k);
          const y = Math.round((sourceBox.top + ds.y - (box.top + dm.y)) * k);
          const w = (sourceBox.width * k).toFixed(1);
          const h = (sourceBox.height * k).toFixed(1);
          const value = `${x}|${y}|${w}|${h}`;
          if (value === lastMask.get(el)) continue;
          lastMask.set(el, value);
          el.style.setProperty('--mask-pos', `${x}px ${y}px`);
          el.style.setProperty('--mask-size', `${w}px ${h}px`);
        }
      }

      if (pointerMoved && base?.ink.length) {
        const di = reactiveLayer === undefined ? { x: 0, y: 0 } : moved(reactiveLayer);
        base.ink.forEach((b, i) => {
          const dx = b.left + b.width / 2 + di.x - P.cx;
          const dy = b.top + b.height / 2 + di.y - P.cy;
          const d = Math.hypot(dx, dy) || 1;
          const near = Math.max(0, 1 - d / REACT_PX) ** 1.5;
          writeInk(reactive[i], [near, (dx / d) * near, (dy / d) * near, Math.sign(dx) * near]);
        });
      }
      if (inkReset) for (const el of reactive) writeInk(el, [0, 0, 0, 0]);

      if (stageBox) {
        const p = Math.min(1, Math.max(0, -stageBox.top / stageBox.height));
        if (Math.abs(p - lastProgress) >= 0.0005) {
          lastProgress = p;
          if (progressVar && !reducedMotion) stage!.style.setProperty(progressVar, p.toFixed(4));
          report?.(p);
        }
      }

      shown = next;
      scrolled = false;
      measure = false;
      pointerMoved = false;
      inkReset = false;
      const settling = parallax && (Math.abs(P.tx - P.x) > SETTLED || Math.abs(P.ty - P.y) > SETTLED);
      if (settling || now < activeUntil) wake();
      else last = 0;
    }

    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function onPointerMove(e: PointerEvent) {
      if (!visible || !parallax || e.pointerType === 'touch') return;
      P.tx = e.clientX;
      P.ty = e.clientY;
      P.cx = e.clientX;
      P.cy = e.clientY;
      pointerMoved = true;
      wake();
    }
    function onPointerLeave() {
      if (!reactive.length) return;
      P.cx = P.cy = -1e4;
      inkReset = true;
      wake();
    }
    function onScroll() {
      scrolled = true;
      measure = true;
      activeUntil = performance.now() + SCROLL_MS;
      wake();
    }
    function onResize() {
      sized = false;
      onScroll();
    }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else {
        measure = true;
        wake();
      }
    }

    // the scroll position always matters (the masthead); the hero's own
    // drawing only while it is on screen
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        scrolled = measure = true;
        wake();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
        // gone past it: let the masthead know it is fully scrolled away
        if (entry.boundingClientRect.bottom <= 0 && lastProgress !== 1) {
          lastProgress = 1;
          if (progressVar && !reducedMotion) stage.style.setProperty(progressVar, '1');
          config.current.onProgress?.(1);
        }
      }
    });
    io.observe(stage);
    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    // the masks may also be out of register once the fonts have arrived, or
    // an entrance animation has carried a plane to its resting place
    function onSettle() {
      sized = false;
      measure = true;
      wake();
    }
    void document.fonts?.ready.then(onSettle);
    stage.addEventListener('animationend', onSettle);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      stage.removeEventListener('animationend', onSettle);
      if (progressVar) stage.style.removeProperty(progressVar);
      for (const el of planes) el?.style.removeProperty('transform');
    };
  }, [stageRef, reactiveSelector, reactiveLayer, reducedMotion, progressVar]);
}
