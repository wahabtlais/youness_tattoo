import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { TattooWork } from '../../../domain/work';
import { layoutArchive, type ArchiveLayout } from './layout';
import { buildRopeTiles, drawRope, type RopeTiles } from './ropeRenderer';

export interface PrintPose {
  /** centre of the print on screen, its unrotated size and its angle */
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  /** paper border width */
  border: number;
}

/** imperative handle the archive's components drive the motion through */
export interface ArchiveEngine {
  hover(i: number | null): void;
  /** bring a print into view (keyboard focus, a pick near the edge) */
  reveal(i: number): void;
  /** stop the archive (picking, detail open) or let it drift again */
  hold(on: boolean): void;
  /** the rope springs back where a print was pulled off it */
  release(i: number): void;
  /** a print is clipped back on: a small swing */
  rehang(i: number): void;
  /**
   * Pin a print's swing while something else (the return flight) owns it:
   * it holds its resting angle, with no spin, until released.
   */
  pin(i: number | null): void;
  pose(i: number): PrintPose | null;
  /** true once after a drag, so the drag's pointerup doesn't count as a pick */
  consumeDrag(): boolean;
}

interface Options {
  pieces: TattooWork[];
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ropeSrc: string;
  reducedMotion: boolean;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The archive's physics, in one requestAnimationFrame loop that writes
 * transforms straight to the DOM - React never re-renders for motion.
 *
 * - drift: a slow ambient travel right to left, which pointer, drag,
 *   trackpad and focus take over and hand back
 * - rope: a sagging curve, plus one travelling disturbance (a dip under
 *   the touched print, a recoil where a print was pulled off)
 * - prints: hang from the rope at their clip, swing on a damped spring from
 *   the archive's speed, settle toward level when touched
 * Paused off screen. Reduced motion: no drift, no swing, no rope play.
 */
export function useArchiveMotion({ pieces, stageRef, canvasRef, ropeSrc, reducedMotion }: Options) {
  const engineRef = useRef<ArchiveEngine | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hangs = Array.from(stage.querySelectorAll<HTMLElement>('[data-hang]'));
    const n = hangs.length;

    let L: ArchiveLayout = layoutArchive(pieces, stage.clientWidth);
    let width = stage.clientWidth;
    let tiles: RopeTiles | null = null;

    // motion state
    let offset = 0;
    let speed = 0;
    let target: number | null = null; // offset the archive is easing toward (reveal)
    let hovered: number | null = null;
    let inside = false;
    let held = false;
    let focusWithin = false;
    let pinned: number | null = null;
    const angle = new Float32Array(n);
    const spin = new Float32Array(n);
    // the rope's one disturbance: where, how much, how fast it is changing
    let dipX = 0;
    let dip = 0;
    let dipV = 0;
    let dipTarget = 0;
    let dipFollows: number | null = null;

    // drag
    let pointerId: number | null = null;
    let dragStartX = 0;
    let dragStartOffset = 0;
    let dragging = false;
    let dragged = false;
    let lastX = 0;
    let lastT = 0;
    let flingV = 0;

    const curve = (x: number) => {
      const u = (x - width / 2) / (width * 0.62);
      const base = L.ropeY + L.sag * (1 - u * u);
      const d = (x - dipX) / (140 * L.unit);
      return base + dip * Math.exp(-d * d);
    };
    const screenX = (i: number) => {
      const p = L.prints[i];
      const pad = Math.max(...L.prints.map((q) => q.w));
      return mod(p.x + offset + pad, L.track) - pad;
    };

    // a relayout mid-pick would move the print out from under the hand
    // (e.g. the scrollbar going away as the dialog opens): wait for release
    let pendingResize = false;
    let laidOutAt = 0; // the width the prints were last laid out for
    function resize() {
      if (held) {
        pendingResize = true;
        return;
      }
      width = stage!.clientWidth;
      // a scrollbar coming or going (e.g. as a dialog opens or closes) is
      // not a new layout: keep every print where it is, just refit the rope
      if (laidOutAt && Math.abs(width - laidOutAt) < 32) {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas!.width = Math.round(width * dpr);
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
        return;
      }
      laidOutAt = width;
      L = layoutArchive(pieces, width);
      stage!.style.height = `${L.stageHeight}px`;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const ch = Math.ceil(L.ropeY + L.sag + L.rope * 2 + 24);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(ch * dpr);
      canvas!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      hangs.forEach((el, i) => {
        const p = L.prints[i];
        el.style.width = `${p.w}px`;
        el.style.setProperty('--print-h', `${p.h}px`);
        el.style.setProperty('--hang', `${p.hang}px`);
        el.style.setProperty('--border', `${L.border}px`);
      });
      for (let i = 0; i < n; i++) angle[i] = L.prints[i].angle;
      draw();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, canvas!.height);
      if (tiles) drawRope(ctx!, tiles, width, offset, curve, L.rope);
      for (let i = 0; i < n; i++) {
        const x = screenX(i);
        const p = L.prints[i];
        // the clip sits on the rope's upper strands
        const y = curve(x) - L.rope * 0.3;
        hangs[i].style.transform = `translate3d(${(x - p.w / 2).toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${angle[i].toFixed(3)}deg)`;
      }
    }

    let raf = 0;
    let last = 0;
    let running = false;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const f = dt * 60; // 1 at 60fps

      if (!dragging) {
        if (target !== null) {
          const step = (target - offset) * (1 - Math.pow(0.86, f));
          offset += step;
          speed = step / Math.max(dt, 1e-3);
          if (Math.abs(target - offset) < 0.5) target = null;
        } else {
          const ambient = reducedMotion || held || focusWithin ? 0 : L.drift * (hovered !== null ? 0 : inside ? 0.3 : 1);
          flingV *= Math.pow(0.94, f);
          if (Math.abs(flingV) < 2) flingV = 0;
          const wanted = ambient + flingV;
          speed += (wanted - speed) * (1 - Math.pow(held ? 0.82 : 0.95, f));
          offset += speed * dt;
        }
      }

      if (!reducedMotion) {
        // swing: the bottom of each print lags behind the rope's travel
        const lag = clamp(speed * 0.011, -5, 5);
        for (let i = 0; i < n; i++) {
          if (i === pinned) continue;
          const rest = L.prints[i].angle * (i === hovered ? 0.2 : 1);
          spin[i] += ((rest + lag) - angle[i]) * 0.045 * f;
          spin[i] *= Math.pow(0.86, f);
          angle[i] += spin[i] * f;
        }
        // the rope's disturbance: a damped spring toward its target
        if (dipFollows !== null) dipX = screenX(dipFollows);
        dipV += (dipTarget - dip) * 0.09 * f;
        dipV *= Math.pow(0.84, f);
        dip += dipV * f;
      }
      draw();
    }

    function sync() {
      const should = visible && !document.hidden;
      if (should && !running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }
    let visible = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(stage);
    document.addEventListener('visibilitychange', sync);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      tiles = buildRopeTiles(img);
      draw();
    };
    img.src = ropeSrc;

    // ---- input ----
    function onPointerDown(e: PointerEvent) {
      if (held || e.button !== 0) return;
      pointerId = e.pointerId;
      dragStartX = lastX = e.clientX;
      dragStartOffset = offset;
      lastT = performance.now();
      dragging = false;
      dragged = false;
      flingV = 0;
      target = null;
    }
    function onPointerMove(e: PointerEvent) {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - dragStartX;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        dragged = true;
        stage!.setPointerCapture(e.pointerId);
        stage!.dataset.dragging = 'true';
      }
      if (!dragging) return;
      const now = performance.now();
      const v = ((e.clientX - lastX) / Math.max(now - lastT, 1)) * 1000;
      speed = speed * 0.6 + v * 0.4;
      lastX = e.clientX;
      lastT = now;
      offset = dragStartOffset + dx;
    }
    function onPointerUp(e: PointerEvent) {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      if (dragging) {
        flingV = clamp(speed, -1600, 1600);
        dragging = false;
        delete stage!.dataset.dragging;
        // the click a drag produces fires right after pointerup; after that
        // tick the next click (or Enter) is a real pick again
        setTimeout(() => (dragged = false), 0);
      }
    }
    function onWheel(e: WheelEvent) {
      // only horizontal intent; vertical wheel keeps scrolling the page
      if (held || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      target = null;
      offset -= e.deltaX;
      flingV = clamp(-e.deltaX * 8, -900, 900);
    }
    const onEnter = () => (inside = true);
    const onLeave = () => (inside = false);
    // only a keyboard user browsing the prints holds the archive still; focus
    // that a closing dialog hands back (or a mouse click gives) does not
    const onFocusIn = (e: FocusEvent) => {
      const from = e.relatedTarget as Element | null;
      const to = e.target as Element;
      if (from?.closest('dialog') || !to.matches(':focus-visible')) return;
      focusWithin = true;
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!stage!.contains(e.relatedTarget as Node | null)) focusWithin = false;
    };
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerenter', onEnter);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('focusin', onFocusIn);
    stage.addEventListener('focusout', onFocusOut);
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    engineRef.current = {
      hover(i) {
        if (i === hovered) return;
        hovered = i;
        if (reducedMotion) return;
        if (i === null) {
          dipTarget = 0;
          return;
        }
        dipFollows = i;
        dipX = screenX(i);
        dipTarget = 7 * L.unit;
        // the neighbours feel it through the rope
        for (const j of [i - 1, i + 1]) if (j >= 0 && j < n) spin[j] += (j < i ? -0.25 : 0.25);
      },
      reveal(i) {
        const x = screenX(i);
        const w = L.prints[i].w;
        const margin = w / 2 + Math.min(80, width * 0.08);
        if (x < margin) target = offset + (margin - x);
        else if (x > width - margin) target = offset - (x - (width - margin));
        if (reducedMotion && target !== null) {
          offset = target;
          target = null;
          draw();
        }
      },
      hold(on) {
        held = on;
        if (on) {
          flingV = 0;
          return;
        }
        // back on the rope: forget the pointer/focus state from before the
        // pick (the dialog covered the archive, so no leave events came)
        hovered = null;
        dipTarget = 0;
        inside = stage!.matches(':hover');
        focusWithin = false;
        if (pendingResize) {
          pendingResize = false;
          resize();
        }
      },
      release(i) {
        if (reducedMotion) return;
        dipFollows = null;
        dipX = screenX(i);
        // pulled down, then let go: the rope snaps up and settles
        dip = 10 * L.unit;
        dipV = -9 * L.unit;
        dipTarget = 0;
        for (const j of [i - 1, i + 1]) if (j >= 0 && j < n) spin[j] += j < i ? 1.4 : -1.4;
      },
      pin(i) {
        pinned = i;
        if (i === null) return;
        // at rest: exactly the angle the swing would settle to, not moving
        angle[i] = L.prints[i].angle + clamp(speed * 0.011, -5, 5);
        spin[i] = 0;
      },
      rehang(i) {
        // the slightest give as the clip takes the weight again
        if (!reducedMotion) spin[i] += 0.25;
      },
      pose(i) {
        const print = hangs[i]?.querySelector<HTMLElement>('[data-print]');
        if (!print) return null;
        const r = print.getBoundingClientRect();
        return {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          w: print.offsetWidth,
          h: print.offsetHeight,
          angle: angle[i],
          border: L.border,
        };
      },
      consumeDrag() {
        const was = dragged;
        dragged = false;
        return was;
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerenter', onEnter);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('focusin', onFocusIn);
      stage.removeEventListener('focusout', onFocusOut);
      engineRef.current = null;
    };
  }, [pieces, stageRef, canvasRef, ropeSrc, reducedMotion]);

  // a stable getter: callers read the live engine without depending on it
  return useCallback(() => engineRef.current, []);
}
