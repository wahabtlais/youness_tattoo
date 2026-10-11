import { gsap } from 'gsap';
import type { DetailLayout } from './layoutV2';

/**
 * Version B's motion: two prints changing places on the rope.
 *
 * Ownership: this module is the only thing that moves a print's box (its
 * transform: x, y, scale, rotation). The archive's pick and return own the
 * large print's paper inside it (visibility, lift) - a separate element, so
 * the two never write the same property.
 *
 * Layout first, then motion (FLIP): React has already laid every print out
 * in its new place; each starts drawn exactly where it was and travels home
 * on one timeline. Everything is computed from the two layouts up front -
 * per frame the flights only write transforms, they read nothing.
 */

export interface SwapRun {
  kill(): void;
}

interface SwapOptions {
  from: DetailLayout;
  to: DetailLayout;
  fromOrder: number[];
  toOrder: number[];
  /** the small print coming to the middle, and the large one going back on the line */
  incoming: number;
  outgoing: number;
  /** each piece's print box, by piece index */
  prints: (HTMLElement | null)[];
  /** each clip on the rope, by place */
  clips: (HTMLElement | null)[];
  /** the details beneath the large print */
  text: HTMLElement | null;
  /** the rope row, when it scrolls (it recentres on the new large print) */
  scroller: HTMLElement | null;
  reduced: boolean;
  /** halfway: the details show the new piece */
  onMid: () => void;
  onDone: () => void;
}

/** a piece's print in a layout: its centre, width and angle */
function where(l: DetailLayout, order: number[], piece: number) {
  const p = l.places[order.indexOf(piece)];
  return { x: p.cx, y: p.top + p.h / 2, w: p.w, angle: p.angle };
}

/** every print at rest in its place (also the reduced-motion swap) */
export function settle(l: DetailLayout, order: number[], prints: (HTMLElement | null)[]) {
  order.forEach((piece, at) => {
    const el = prints[piece];
    if (el) gsap.set(el, { x: 0, y: 0, scale: 1, rotation: l.places[at].angle, transformOrigin: '50% 50%' });
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function playSwap(o: SwapOptions): SwapRun {
  const { from, to, fromOrder, toOrder, incoming, outgoing, prints, clips, text, scroller } = o;

  if (o.reduced) {
    // no choreography: the two prints are simply in their new places
    settle(to, toOrder, prints);
    for (const clip of clips) if (clip) gsap.set(clip, { x: 0, y: 0 });
    o.onMid();
    o.onDone();
    return { kill() {} };
  }

  // every print and clip starts drawn exactly where it was
  for (const piece of toOrder) {
    const el = prints[piece];
    if (!el) continue;
    const a = where(from, fromOrder, piece);
    const b = where(to, toOrder, piece);
    gsap.set(el, { x: a.x - b.x, y: a.y - b.y, scale: a.w / b.w, rotation: a.angle, transformOrigin: '50% 50%' });
  }
  clips.forEach((clip, at) => {
    if (clip) gsap.set(clip, { x: from.places[at].cx - to.places[at].cx, y: from.places[at].clipY - to.places[at].clipY });
  });

  const inA = where(from, fromOrder, incoming);
  const inB = where(to, toOrder, incoming);
  const dist = Math.hypot(inA.x - inB.x, inA.y - inB.y);
  // distance-aware, within a natural range: carried, not snapped
  const D = clamp(dist / 520, 1.05, 1.3);
  /** the large print leaves first, so the chosen one comes into a space being cleared */
  const LEAD = 0.12;

  const tl = gsap.timeline({ onComplete: done });

  // the neighbours slide along the rope to make room (clips and all)
  for (const piece of toOrder) {
    if (piece === incoming || piece === outgoing) continue;
    const el = prints[piece];
    if (el) tl.to(el, { x: 0, y: 0, duration: D, ease: 'sine.inOut' }, 0);
  }
  for (const clip of clips) if (clip) tl.to(clip, { x: 0, y: 0, duration: D, ease: 'sine.inOut' }, 0);

  // the two prints change places on separate paths, so they pass rather
  // than meet: the large one goes back up and away to the line, bowing
  // toward the rope; the chosen one is drawn down off its clip and comes to
  // the middle bowing toward the viewer, in front
  const flights = [
    fly(tl, prints[outgoing], where(from, fromOrder, outgoing), where(to, toOrder, outgoing), -0.1, 0, D, 5),
    fly(tl, prints[incoming], inA, inB, 0.22, LEAD, D - LEAD, 6),
  ];

  // the details: out, changed while unseen, back in as the print arrives
  // (opacity only - hiding them would drop the focus on the title)
  if (text) {
    tl.to(text, { opacity: 0, y: 6, duration: 0.22, ease: 'power1.in' }, 0);
    tl.add(o.onMid, D * 0.42);
    tl.fromTo(text, { y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, D * 0.58);
  } else tl.add(o.onMid, D * 0.42);

  // a scrolling rope (small screens) recentres on the new large print
  if (scroller && to.width > scroller.clientWidth) {
    const target = clamp(to.places[to.main].cx - scroller.clientWidth / 2, 0, to.width - scroller.clientWidth);
    const s = { left: scroller.scrollLeft };
    if (Math.abs(target - s.left) > 1) {
      tl.to(s, { left: target, duration: D, ease: 'sine.inOut', onUpdate: () => void (scroller.scrollLeft = s.left) }, 0);
    }
  }

  function done() {
    for (const f of flights) f?.land();
    o.onDone();
  }

  return { kill: () => tl.kill() };
}

/**
 * One print's flight: one progress value with one ease drives a curved
 * path, the scale and the angle; a deeper "held" shadow swells and goes.
 * bow bends the path off the straight line, as a fraction of the distance:
 * positive below it (toward the viewer), negative above (toward the rope).
 */
function fly(
  tl: gsap.core.Timeline,
  el: HTMLElement | null,
  a: { x: number; y: number; w: number; angle: number },
  b: { x: number; y: number; w: number; angle: number },
  bow: number,
  at: number,
  duration: number,
  z: number,
) {
  if (!el) return null;
  const lift = el.querySelector<HTMLElement>('[data-lift]');
  // in the print's own translate space: it starts at s, ends at 0
  const s = { x: a.x - b.x, y: a.y - b.y };
  const dist = Math.hypot(s.x, s.y) || 1;
  // the normal to the straight path that points down the screen
  let nx = -s.y / dist;
  let ny = s.x / dist;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const off = dist * bow * 1.33; // a cubic's control points reach ~3/4 of the way out
  const p1 = { x: s.x * 0.68 + nx * off, y: s.y * 0.68 + ny * off };
  const p2 = { x: s.x * 0.28 + nx * off, y: s.y * 0.28 + ny * off };
  const s0 = a.w / b.w;
  const setX = gsap.quickSetter(el, 'x', 'px');
  const setY = gsap.quickSetter(el, 'y', 'px');
  const setScaleX = gsap.quickSetter(el, 'scaleX');
  const setScaleY = gsap.quickSetter(el, 'scaleY');
  const setRotation = gsap.quickSetter(el, 'rotation', 'deg');
  const setLift = lift ? gsap.quickSetter(lift, 'opacity') : null;
  gsap.set(el, { zIndex: z, willChange: 'transform' });

  const progress = { e: 0 };
  const draw = () => {
    const e = progress.e;
    const m = 1 - e;
    const k0 = m * m * m;
    const k1 = 3 * m * m * e;
    const k2 = 3 * m * e * e;
    setX(k0 * s.x + k1 * p1.x + k2 * p2.x);
    setY(k0 * s.y + k1 * p1.y + k2 * p2.y);
    const scale = s0 + (1 - s0) * e;
    setScaleX(scale);
    setScaleY(scale);
    setRotation(a.angle + (b.angle - a.angle) * e);
    setLift?.(Math.sin(Math.PI * e));
  };
  tl.to(progress, { e: 1, duration, ease: 'sine.inOut', onUpdate: draw }, at);
  return {
    land() {
      progress.e = 1;
      draw();
      if (lift) gsap.set(lift, { opacity: 0 });
      gsap.set(el, { clearProps: 'zIndex,willChange' });
    },
  };
}
