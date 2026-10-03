import { gsap } from 'gsap';
import type { ArchiveEngine, PrintPose } from './useArchiveMotion';
import { EDGE_BELOW_PINCH, HAND_VIEWBOX, PINCH, THUMB_PIVOT } from './handGeometry';

/** the pieces of the pick, found by the archive component */
export interface PickParts {
  engine: ArchiveEngine;
  index: number;
  /** the print on the rope, and the other prints */
  print: HTMLElement;
  others: HTMLElement[];
  /** inside the detail dialog */
  paper: HTMLElement;
  clone: HTMLElement;
  handBack: HTMLElement;
  handFront: HTMLElement;
  thumb: SVGGElement;
  slot: HTMLElement;
  text: HTMLElement[];
}

/** where the clone's untransformed box sits; all motion is x/y/scale/rotation about its centre */
interface Base {
  cx: number;
  cy: number;
  w: number;
  h: number;
}
let base: Base | null = null;

const THUMB_OPEN = -26;

function placeClone(clone: HTMLElement, pose: PrintPose) {
  base = { cx: pose.cx, cy: pose.cy, w: pose.w, h: pose.h };
  gsap.set(clone, {
    left: pose.cx - pose.w / 2,
    top: pose.cy - pose.h / 2,
    width: pose.w,
    height: pose.h,
    x: 0,
    y: 0,
    scale: 1,
    rotation: pose.angle,
    transformOrigin: '50% 50%',
    autoAlpha: 1,
  });
}

/** detail image box, centred where the layout reserved it */
function slotBox(slot: HTMLElement) {
  const r = slot.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
}

/** a running pick or return; kill() stops whichever part is playing */
export interface PickRun {
  kill(): void;
}

/**
 * The pick, as one choreography:
 *   1 select  - the archive stops, the others recede, the print lifts
 *   2 enter   - the hand travels up from below the archive
 *   3 reach   - it slows and aligns under the print, thumb open
 *   4 grab    - the thumb closes on the print; the print gives a little
 *   5 pull    - hand and print come off the rope toward the viewer; the
 *               rope springs back, the clip stays on it
 *   6 detail  - the hand lets go and drops away, the paper comes up, and
 *               the same print travels into the detail layout
 * Phase 1 plays on the rope; everything after is measured from where the
 * print ended up, so it runs as a second timeline.
 */
export function playPick(p: PickParts, onDetail: () => void): PickRun {
  const { engine, index, print, others, paper, clone, handBack, handFront, thumb, slot, text } = p;
  const vh = innerHeight;
  let current: gsap.core.Timeline | null = null;
  engine.hold(true);
  engine.reveal(index);
  gsap.set(text, { autoAlpha: 0, y: 14 });
  gsap.set([paper, slot], { autoAlpha: 0 });

  // 1 - select (on the rope itself)
  const select = gsap.timeline({ onComplete: () => (current = takeDown()) });
  select.to(others, { opacity: 0.45, filter: 'saturate(0.6)', duration: 0.45, ease: 'power2.out' }, 0);
  select.to(print, { y: -10, duration: 0.38, ease: 'power2.out' }, 0);
  current = select;

  function takeDown(): gsap.core.Timeline | null {
    const pose = engine.pose(index);
    if (!pose) return null;
    placeClone(clone, pose);
    print.style.visibility = 'hidden';
    const b = base!;
    const box = slotBox(slot);

    // the hand, scaled to the print, its pinch under the print's bottom edge
    const handW = Math.min(250, Math.max(118, pose.w * 0.92));
    const s = handW / HAND_VIEWBOX.w;
    const pinch = { x: pose.cx - pose.w * 0.08, y: pose.cy + pose.h / 2 - EDGE_BELOW_PINCH * s };
    const hand = [handBack, handFront];
    const handTop = pinch.y - PINCH.y * s;
    gsap.set(hand, {
      left: pinch.x - PINCH.x * s,
      top: handTop,
      width: handW,
      height: HAND_VIEWBOX.h * s,
      transformOrigin: `${PINCH.x * s}px ${PINCH.y * s}px`,
      x: 70 * s,
      y: vh - handTop + 40,
      rotation: 11,
      autoAlpha: 1,
    });
    gsap.set(thumb, { rotation: THUMB_OPEN, svgOrigin: THUMB_PIVOT });

    // pulled toward the viewer: down a little and larger, scaled about the
    // pinch so print and hand stay together
    const pull = Math.min(150, vh * 0.16);
    const k = 1.16;
    const nudge = 4;
    const pulledX = pinch.x + k * (b.cx - pinch.x) - b.cx;
    const pulledY = pinch.y + nudge + pull + k * (b.cy - pinch.y) - b.cy;

    const tl = gsap.timeline();
    // the print settles toward level as it is singled out
    tl.to(clone, { rotation: pose.angle * 0.3, duration: 0.45, ease: 'power2.out' }, 0);
    // 2 - enter: up from below, still turned a little
    tl.to(hand, { y: 26 * s, x: 14 * s, rotation: 3, duration: 0.6, ease: 'power3.out' }, 0);
    // 3 - reach: slow, precise alignment
    tl.to(hand, { y: 0, x: 0, rotation: 0, duration: 0.28, ease: 'power2.inOut' }, '>-0.04');
    // 4 - grab
    tl.addLabel('grab');
    tl.to(thumb, { rotation: 0, duration: 0.18, ease: 'power3.in' }, 'grab');
    tl.to(clone, { y: nudge, rotation: 0, duration: 0.18, ease: 'power2.in' }, 'grab+=0.05');
    tl.to(hand, { y: nudge, duration: 0.18, ease: 'power2.in' }, 'grab+=0.05');
    // 5 - pull
    tl.addLabel('pull', '+=0.06');
    tl.add(() => engine.release(index), 'pull');
    tl.to(hand, { y: nudge + pull, scale: k, duration: 0.6, ease: 'power2.inOut' }, 'pull');
    tl.to(clone, { x: pulledX, y: pulledY, scale: k, duration: 0.6, ease: 'power2.inOut' }, 'pull');
    // 6 - detail
    tl.addLabel('detail', '-=0.05');
    tl.to(paper, { autoAlpha: 1, duration: 0.6, ease: 'power1.inOut' }, 'detail');
    tl.to(thumb, { rotation: THUMB_OPEN * 0.6, duration: 0.18 }, 'detail');
    tl.to(hand, { y: `+=${vh * 0.8}`, rotation: 6, duration: 0.75, ease: 'power2.in' }, 'detail+=0.08');
    tl.to(
      clone,
      { x: box.cx - b.cx, y: box.cy - b.cy, scale: box.w / b.w, rotation: 0, duration: 0.85, ease: 'power3.inOut' },
      'detail',
    );
    tl.to(text, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, 'detail+=0.5');
    tl.add(() => {
      gsap.set(slot, { autoAlpha: 1 });
      gsap.set([clone, ...hand], { autoAlpha: 0 });
      onDetail();
    }, 'detail+=0.9');
    return tl;
  }

  return {
    kill() {
      select.kill();
      current?.kill();
    },
  };
}

/** Detail back onto the rope: the same print flies back to its clip. */
export function playReturn(p: PickParts, onDone: () => void): PickRun {
  const { engine, index, print, others, paper, clone, slot, text } = p;
  gsap.set(print, { y: 0 });
  const pose = engine.pose(index);
  if (!pose || !base) {
    resetPick(p);
    onDone();
    return { kill() {} };
  }
  const b = base;
  // the clone takes over from the detail image, exactly where it is
  const box = slotBox(slot);
  gsap.set(clone, { x: box.cx - b.cx, y: box.cy - b.cy, scale: box.w / b.w, rotation: 0, autoAlpha: 1 });
  gsap.set(slot, { autoAlpha: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      print.style.visibility = '';
      gsap.set(clone, { autoAlpha: 0 });
      engine.rehang(index);
      onDone();
    },
  });
  tl.to(text, { autoAlpha: 0, y: 8, duration: 0.22, stagger: 0.03, ease: 'power1.in' }, 0);
  tl.to(paper, { autoAlpha: 0, duration: 0.55, ease: 'power1.inOut' }, 0.15);
  tl.to(
    clone,
    { x: pose.cx - b.cx, y: pose.cy - b.cy, scale: pose.w / b.w, rotation: pose.angle, duration: 0.7, ease: 'power3.inOut' },
    0.15,
  );
  tl.to(others, { opacity: 1, filter: 'saturate(1)', duration: 0.6, ease: 'power1.out' }, 0.4);
  return { kill: () => tl.kill() };
}

/** No animation (reduced motion, Find Similar, or an interrupted pick): put everything back. */
export function resetPick(p: PickParts) {
  gsap.killTweensOf([p.print, ...p.others, p.paper, p.clone, p.handBack, p.handFront, p.thumb, p.slot, ...p.text]);
  gsap.set(p.print, { y: 0 });
  p.print.style.visibility = '';
  gsap.set(p.others, { opacity: 1, filter: 'none' });
  gsap.set([p.clone, p.handBack, p.handFront], { autoAlpha: 0 });
}

/** Reduced motion: straight to the detail, no flight. */
export function showDetailStatic(p: PickParts) {
  p.engine.hold(true);
  gsap.set([p.paper, p.slot], { autoAlpha: 1 });
  gsap.set(p.text, { autoAlpha: 1, y: 0 });
  gsap.set([p.clone, p.handBack, p.handFront], { autoAlpha: 0 });
}
