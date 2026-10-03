import { gsap } from 'gsap';
import type { ArchiveEngine, PrintPose } from './useArchiveMotion';
import type { ArmStage } from './arm/armStage';
import { ARM } from './arm/armConfig';

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
  slot: HTMLElement;
  text: HTMLElement[];
  /** the 3D arm, once loaded (null: the print is taken without it) */
  arm: ArmStage | null;
}

/** a running pick or return; kill() stops whichever part is playing */
export interface PickRun {
  kill(): void;
}

/** where the clone's untransformed box sits; all motion is x/y/scale/rotation about its centre */
interface Base {
  cx: number;
  cy: number;
  w: number;
  h: number;
}
let base: Base | null = null;

/** the flying print's extra "held" shadow layer (see .pa-lift) */
const lift = (clone: HTMLElement) => clone.querySelector<HTMLElement>('[data-lift]');

function placeClone(clone: HTMLElement, pose: PrintPose) {
  base = { cx: pose.cx, cy: pose.cy, w: pose.w, h: pose.h };
  const l = lift(clone);
  if (l) gsap.set(l, { opacity: 0 });
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

/** the flight into the detail and the text arriving - shared by both paths */
function addDetail(tl: gsap.core.Timeline, p: PickParts, at: string, onDetail: () => void, flight = 0.85) {
  const b = base!;
  const box = slotBox(p.slot);
  tl.to(p.paper, { autoAlpha: 1, duration: flight * 0.8, ease: 'power1.inOut' }, at);
  tl.to(
    p.clone,
    { x: box.cx - b.cx, y: box.cy - b.cy, scale: box.w / b.w, rotation: 0, duration: flight, ease: 'power3.inOut' },
    at,
  );
  tl.to(p.text, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, `${at}+=${flight * 0.6}`);
  // the held shadow goes as the print settles into the detail
  tl.to(lift(p.clone), { opacity: 0, duration: flight, ease: 'power2.inOut' }, at);
  tl.add(() => {
    gsap.set(p.slot, { autoAlpha: 1 });
    // the flying copy stays laid out on its own (already rasterised) layer,
    // invisible, so the return can start without creating one
    gsap.set(p.clone, { autoAlpha: 0.001, willChange: 'transform' });
    onDetail();
  }, `${at}+=${flight + 0.05}`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The pick. The hand goes to an EDGE of the print and the print comes to
 * the hand - the hand never passes through the photograph. Absolute times
 * from the click:
 *   0.00-0.25  anticipation - the archive stops, the others recede, the print lifts
 *   0.25-1.05  enter        - the arm comes in on a diagonal from the bottom right
 *   1.05-1.40  approach     - slow, onto the print's lower edge (it stops short)
 *   1.40-1.55  settle       - the hand stops at the contact point
 *   1.55-1.75  give         - the PRINT comes 14px to the hand, turns, its
 *                             shadow deepens; it is now attached to the hand
 *   1.75-2.35  pull         - hand and print together, off the rope (which
 *                             recoils), down and toward the viewer
 *   2.35-2.70  release      - the hand lets go and the arm retreats below
 *   2.50-3.10  detail       - the same print flies on into the detail layout
 * The anticipation plays on the rope; everything after is measured from
 * where the print ended up, so it runs as a second timeline.
 */
export function playPick(p: PickParts, onDetail: () => void): PickRun {
  const { engine, index, print, others, clone, text, arm } = p;
  let current: gsap.core.Timeline | null = null;
  let killed = false;
  engine.hold(true);
  engine.reveal(index);
  gsap.set(text, { autoAlpha: 0, y: 14 });
  gsap.set([p.paper, p.slot], { autoAlpha: 0 });

  // anticipation (~250ms, on the rope itself): the archive stops, the
  // others recede, the print lifts; the arm is still below the screen
  const select = gsap.timeline({ onComplete: () => void takeDown() });
  select.to(others, { opacity: 0.45, filter: 'saturate(0.6)', duration: 0.4, ease: 'power2.out' }, 0);
  select.to(print, { y: -10, duration: 0.25, ease: 'power2.out' }, 0);
  current = select;

  async function takeDown() {
    // the arm has normally loaded long before (when the archive came into view)
    const ready = arm
      ? await Promise.race([arm.ready().then(() => true), wait(1200).then(() => false)]).catch(() => false)
      : false;
    if (killed) return;
    const pose = engine.pose(index);
    if (!pose) return;
    placeClone(clone, pose);
    print.style.visibility = 'hidden';
    current = ready && arm ? withArm(arm, pose) : withoutArm();
  }

  function withArm(stage: ArmStage, pose: PrintPose) {
    const vw = innerWidth;
    const vh = innerHeight;
    const portrait = vh > vw;
    // config distances are for a ~200px print; scale them to this one
    const u = pose.w / 200;
    const hand = pose.w * (vw < 700 ? ARM.handPerPrintWidthMobile : ARM.handPerPrintWidth);
    stage.setPrint(clone, base!, hand);

    // the contact point, low and right on the print
    const contact = {
      x: pose.cx + (ARM.contact.x - 0.5) * pose.w,
      y: pose.cy + (ARM.contact.y - 0.5) * pose.h,
    };
    // the arm's line: from one shoulder below the screen, leaning toward the
    // print within a believable range; d points from the hand back along
    // the arm (down and to the right)
    const [sx, sy] = portrait ? ARM.shoulderPortrait : ARM.shoulder;
    const raw = (Math.atan2(vw * sx - contact.x, vh * sy - contact.y) * 180) / Math.PI;
    const lean = Math.max(ARM.lean.min, Math.min(ARM.lean.max, raw));
    const d = { x: Math.sin((lean * Math.PI) / 180), y: Math.cos((lean * Math.PI) / 180) };
    const depth = ARM.depth * u;

    /*
     * One rigid arm, three continuous moves. Each is ONE tween of a progress
     * value along a cubic Bezier, with ONE ease; position, depth and lean
     * all follow that same progress, so velocity and rotation never jump.
     * Each move starts exactly where the last ended (the arm is never reset).
     */
    const P = (x: number, y: number) => ({ x, y });
    const bezier = (a: Pt, b: Pt, c: Pt, e: Pt, t: number) => {
      const m = 1 - t;
      return {
        x: m * m * m * a.x + 3 * m * m * t * b.x + 3 * m * t * t * c.x + t * t * t * e.x,
        y: m * m * m * a.y + 3 * m * m * t * b.y + 3 * m * t * t * c.y + t * t * t * e.y,
      };
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    type Pt = { x: number; y: number };
    const move = (path: [Pt, Pt, Pt, Pt], z: [number, number], rz: [number, number]) => (t: number) => {
      const at = bezier(...path, t);
      stage.pose.x = at.x;
      stage.pose.y = at.y;
      stage.pose.z = lerp(z[0], z[1], t);
      stage.pose.rz = lerp(rz[0], rz[1], t);
    };

    // REACH: emerges from below the screen heading up, curves onto the arm's
    // line, and arrives at the contact point along it - decelerating the
    // whole way to the contact (power2.out: fast, then continuously slower)
    const L = (vh - contact.y) / d.y + hand * 1.1; // far enough back to start fully off screen
    const start = P(contact.x + d.x * L + L * ARM.curve, contact.y + d.y * L);
    const reach = move(
      [start, P(start.x, start.y - L * 0.45), P(contact.x + d.x * L * 0.3, contact.y + d.y * L * 0.3), contact],
      [depth + 40 * u, depth],
      [lean + ARM.turn, lean],
    );
    // PULL: from exactly where the reach ended, along the arm and toward the
    // viewer, drawn a little toward the middle of the screen
    const inward = (vw / 2 - contact.x) * ARM.pullToCentre;
    const pulled = P(contact.x + d.x * ARM.pull * u + inward, contact.y + d.y * ARM.pull * u);
    const pull = move(
      [contact, P(contact.x + d.x * ARM.pull * u * 0.35, contact.y + d.y * ARM.pull * u * 0.35), pulled, pulled],
      [depth, depth + ARM.pullDepth * u],
      [lean, lean - 2],
    );
    // RETREAT: lets go and drops away down its own line, below the screen
    const gone = P(pulled.x + d.x * vh * 0.9, pulled.y + d.y * vh * 0.9);
    const retreat = move(
      [pulled, P(pulled.x + d.x * vh * 0.3, pulled.y + d.y * vh * 0.3), gone, gone],
      [depth + ARM.pullDepth * u, depth + ARM.pullDepth * u + 60 * u],
      [lean - 2, lean + 2],
    );

    gsap.set(stage.pose, { rx: ARM.tilt, ry: 0 });
    reach(0);
    stage.start();

    const drive = { reach: 0, pull: 0, retreat: 0 };
    const tl = gsap.timeline({ onComplete: () => stage.stop() });
    // the print settles toward level while the arm comes in
    tl.to(clone, { rotation: pose.angle * 0.3, duration: 0.6, ease: 'power2.out' }, 0);
    // 0.25-1.40 reach: one continuous, decelerating move onto the contact point
    tl.to(drive, { reach: 1, duration: 1.15, ease: 'power2.out', onUpdate: () => reach(drive.reach) }, 0);
    // 1.40-1.55 a short settle: the hand is still; then the PRINT comes to it,
    // turns a little, its shadow deepens - that is the grab
    tl.to(
      clone,
      {
        x: `+=${d.x * ARM.give * u}`,
        y: `+=${d.y * ARM.give * u}`,
        rotation: ARM.giveTurn,
        duration: 0.2,
        ease: 'power2.inOut',
      },
      1.27,
    );
    // ...and its shadow deepens: lifted off the paper
    tl.to(lift(clone), { opacity: 1, duration: 0.25, ease: 'power2.out' }, 1.27);
    tl.add(() => stage.attach(), 1.47);
    // ~1.72-2.35 pull: hand and print together, starting the moment the print
    // is held (a gentle ease, so it doesn't read as a freeze)
    tl.add(() => engine.release(index), 1.47);
    tl.to(drive, { pull: 1, duration: 0.63, ease: 'power1.inOut', onUpdate: () => pull(drive.pull) }, 1.47);
    // 2.35-2.70 release and retreat: from rest, accelerating away below the screen
    tl.add(() => stage.release(), 2.1);
    tl.to(drive, { retreat: 1, duration: 0.45, ease: 'power2.in', onUpdate: () => retreat(drive.retreat) }, 2.1);
    // ~2.35-3.10 detail: the print, released at rest, flies on into the detail
    tl.addLabel('detail', 2.12);
    addDetail(tl, p, 'detail', onDetail, 0.72);
    return tl;
  }

  /** the arm could not load: the print lifts off and flies on by itself */
  function withoutArm() {
    const tl = gsap.timeline();
    tl.to(clone, { rotation: 0, y: -24, scale: 1.06, duration: 0.45, ease: 'power2.out' }, 0);
    tl.add(() => engine.release(index), 0.1);
    tl.addLabel('detail', 0.4);
    addDetail(tl, p, 'detail', onDetail);
    return tl;
  }

  return {
    kill() {
      killed = true;
      select.kill();
      current?.kill();
      arm?.stop();
    },
  };
}

/** a CSS-style cubic-bezier(x1, y1, x2, y2) as an ease function */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

/**
 * The return's ease: an unhurried departure, a little faster through the
 * middle, then a long, soft arrival - still easing in as it meets the clip.
 */
const RETURN_EASE = cubicBezier(0.5, 0.05, 0.35, 1);
/** average px/s the return is timed at (near prints return sooner), clamped to a natural range */
const RETURN_SPEED = 500;
const RETURN_MIN = 0.9;
const RETURN_MAX = 1.2;

/**
 * The detail closes (Close, Escape or a click on the paper - all of them):
 * the same print is placed back on its clip as ONE physical movement.
 *
 * Built for steady frame pacing - per frame it writes exactly one transform
 * and reads nothing:
 * - The destination (the clip's position, angle and size) is measured ONCE,
 *   at the start; the archive stays still until the print has landed, so
 *   that measurement stays true, and the print's own swing is pinned. This
 *   function is the only thing moving the print.
 * - One progress value with one ease drives a gently curved path, the
 *   scale and the rotation (with a small mid-flight correction); the
 *   shadow scales with the print. The flying copy's layer was rasterised
 *   while the detail was open, so the first frame creates nothing. The
 *   paper and the other prints fade back with CSS transitions, which run
 *   on the compositor.
 * - On landing the flying copy is exactly the hanging print; it swaps,
 *   the swing is released from rest, and the archive drifts on from rest.
 */
export function returnPhotoToArchive(p: PickParts, onDone: () => void): PickRun {
  const { engine, index, print, others, paper, clone, slot, text } = p;
  gsap.set(print, { y: 0 });
  // the print as it hangs: no hover/focus lift (touch screens keep :hover
  // on the tapped print) - set before measuring, cleared when the pointer
  // or focus next moves on
  const photo = print.closest<HTMLElement>('.pa-photo');
  if (photo) photo.dataset.returned = '';
  engine.pin(index);
  // measured once: where the print hangs, at what angle and size
  const to = engine.pose(index);
  if (!to || !base) {
    resetPick(p);
    onDone();
    return { kill() {} };
  }
  const b = base;
  // the clone takes over from the detail image, exactly where it is
  const box = slotBox(slot);
  const from = { cx: box.cx, cy: box.cy, scale: box.w / b.w };
  const end = { scale: to.w / b.w, rotation: to.angle };
  // swap the detail image for the flying copy: same place, same size, same
  // (pre-scaled) shadow, and its layer already exists - nothing to paint
  gsap.set(clone, { x: from.cx - b.cx, y: from.cy - b.cy, scale: from.scale, rotation: 0, autoAlpha: 1, willChange: 'transform' });
  gsap.set(slot, { autoAlpha: 0 });

  const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const duration = Math.min(RETURN_MAX, Math.max(RETURN_MIN, dist / RETURN_SPEED));
  // a subtle tilt against the direction of travel, gone by the end
  const correction = -Math.sign(to.cx - from.cx) * 1.2;
  // a fixed curve: leaves toward the clip, comes into it from slightly below
  const p1 = { x: from.cx + (to.cx - from.cx) * 0.35, y: from.cy + (to.cy - from.cy) * 0.25 };
  const p2 = { x: to.cx, y: to.cy + dist * 0.16 };
  const setX = gsap.quickSetter(clone, 'x', 'px');
  const setY = gsap.quickSetter(clone, 'y', 'px');
  // (quickSetter needs the real properties - 'scale' is only a shorthand)
  const setScaleX = gsap.quickSetter(clone, 'scaleX');
  const setScaleY = gsap.quickSetter(clone, 'scaleY');
  const setRotation = gsap.quickSetter(clone, 'rotation', 'deg');

  const progress = { e: 0 };
  const fly = () => {
    const e = progress.e;
    const m = 1 - e;
    const k0 = m * m * m;
    const k1 = 3 * m * m * e;
    const k2 = 3 * m * e * e;
    const k3 = e * e * e;
    setX(k0 * from.cx + k1 * p1.x + k2 * p2.x + k3 * to.cx - b.cx);
    setY(k0 * from.cy + k1 * p1.y + k2 * p2.y + k3 * to.cy - b.cy);
    const scale = from.scale + (end.scale - from.scale) * e;
    setScaleX(scale);
    setScaleY(scale);
    setRotation(end.rotation * e + correction * Math.sin(Math.PI * e));
  };

  // the paper and the other prints: compositor-run transitions
  for (const el of [paper, ...others]) el.style.transition = `opacity ${duration * 0.8}s ease, filter ${duration * 0.8}s ease`;
  gsap.set(paper, { opacity: 0 }); // hidden only once it has faded (below)
  gsap.set(others, { opacity: 1, filter: 'saturate(1)' });

  const tl = gsap.timeline({
    onComplete: () => {
      progress.e = 1;
      fly();
      // hand-over: the clone is now exactly the hanging print
      print.style.visibility = '';
      gsap.set(clone, { autoAlpha: 0, willChange: 'auto' });
      gsap.set(paper, { autoAlpha: 0 });
      for (const el of [paper, ...others]) el.style.transition = '';
      engine.pin(null);
      engine.hold(false);
      // the dialog teardown (a React update, unmounting the detail, focus
      // returning) is real work: keep it out of the landing frame, and do it
      // once the print is resting on the rope
      landed = setTimeout(onDone, 180);
    },
  });
  tl.to(text, { autoAlpha: 0, y: 8, duration: 0.22, stagger: 0.03, ease: 'power1.in' }, 0);
  // the shadow shrinks with the print as it returns (transform-scaled)
  tl.to(progress, { e: 1, duration, ease: RETURN_EASE, onUpdate: fly }, 0);
  let landed: ReturnType<typeof setTimeout> | undefined;
  return {
    kill: () => {
      tl.kill();
      clearTimeout(landed);
    },
  };
}

/** No animation (reduced motion, Find Similar, or an interrupted pick): put everything back. */
export function resetPick(p: PickParts) {
  gsap.killTweensOf([p.print, ...p.others, p.paper, p.clone, p.slot, ...p.text]);
  for (const el of [p.paper, ...p.others]) el.style.transition = '';
  p.arm?.stop();
  p.engine.pin(null);
  gsap.set(p.print, { y: 0 });
  p.print.style.visibility = '';
  gsap.set(p.others, { opacity: 1, filter: 'none' });
  gsap.set(p.clone, { autoAlpha: 0 });
}

/** Reduced motion: straight to the detail, no flight, no arm. */
export function showDetailStatic(p: PickParts) {
  p.engine.hold(true);
  gsap.set([p.paper, p.slot], { autoAlpha: 1 });
  gsap.set(p.text, { autoAlpha: 1, y: 0 });
  gsap.set(p.clone, { autoAlpha: 0 });
}
