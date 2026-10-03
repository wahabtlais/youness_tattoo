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

/** the print's shadow once a hand holds it: lifted off the paper */
const GRIPPED_SHADOW =
  '0 0 0 0.5px rgb(20 19 26 / 0.12), 0 3px 3px rgb(20 19 26 / 0.14), 0 16px 26px -8px rgb(20 19 26 / 0.34), 0 34px 48px -20px rgb(20 19 26 / 0.28)';

function placeClone(clone: HTMLElement, pose: PrintPose) {
  base = { cx: pose.cx, cy: pose.cy, w: pose.w, h: pose.h };
  gsap.set(clone, { clearProps: 'boxShadow' });
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
  tl.add(() => {
    gsap.set(p.slot, { autoAlpha: 1 });
    gsap.set(p.clone, { autoAlpha: 0 });
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

    // the contact point, low and right on the print (it hangs nearly level
    // by now; its small remaining angle is ignored)
    const contact = {
      x: pose.cx + (ARM.contact.x - 0.5) * pose.w,
      y: pose.cy + (ARM.contact.y - 0.5) * pose.h,
    };
    // the arm's line: from one shoulder below the screen, leaning toward
    // the print within a believable range; d points from the hand back
    // along the arm (down and to the right)
    const [sx, sy] = portrait ? ARM.shoulderPortrait : ARM.shoulder;
    const raw = (Math.atan2(vw * sx - contact.x, vh * sy - contact.y) * 180) / Math.PI;
    const lean = Math.max(ARM.lean.min, Math.min(ARM.lean.max, raw));
    const d = { x: Math.sin((lean * Math.PI) / 180), y: Math.cos((lean * Math.PI) / 180) };
    /** a pose this far back along the arm from the contact point */
    const along = (dist: number, z: number, rz = lean) => ({
      x: contact.x + d.x * dist,
      y: contact.y + d.y * dist,
      z,
      rx: ARM.tilt,
      ry: 0,
      rz,
    });
    const offscreen = (vh - contact.y) / d.y + hand * 1.2;
    // the pull draws the print toward the middle of the screen as well
    const inward = (vw / 2 - contact.x) * ARM.pullToCentre;
    const pulled = { ...along(ARM.pull * u, ARM.depth * u + ARM.pullDepth * u, lean - 3) };
    pulled.x += inward;

    gsap.set(stage.pose, { ...along(offscreen, ARM.depth * u + 40, lean + 4), reach: 0, grip: 0, pull: 0 });
    stage.start();

    const tl = gsap.timeline({ onComplete: () => stage.stop() });
    // the print settles toward level while the arm comes in
    tl.to(clone, { rotation: pose.angle * 0.3, duration: 0.6, ease: 'power2.out' }, 0);
    // enter (0.25-1.05): quick, then slowing, still turned a little
    tl.to(stage.pose, { ...along(ARM.enterShort * u, ARM.depth * u + 16, lean + 2), duration: 0.8, ease: 'power2.out' }, 0);
    // approach (1.05-1.40): the last few centimetres, slow; stops short of the print's face
    tl.to(stage.pose, { ...along(ARM.approachShort * u, ARM.depth * u), duration: 0.35, ease: 'power3.out' }, 0.8);
    // settle (1.40-1.55): the hand stops on the contact point
    tl.to(stage.pose, { ...along(0, ARM.depth * u), duration: 0.15, ease: 'sine.inOut' }, 1.15);
    tl.to(stage.pose, { reach: 1, duration: 1.15, ease: 'power1.inOut' }, 0);
    // give (1.55-1.75): the PRINT comes to the hand, turns, its shadow deepens
    tl.to(stage.pose, { grip: 1, duration: 0.35, ease: 'power1.inOut' }, 1.15);
    tl.to(
      clone,
      {
        x: `+=${d.x * ARM.give * u}`,
        y: `+=${d.y * ARM.give * u}`,
        rotation: ARM.giveTurn,
        boxShadow: GRIPPED_SHADOW,
        duration: 0.2,
        ease: 'power2.inOut',
      },
      1.3,
    );
    tl.add(() => stage.attach(), 1.5);
    // pull (1.75-2.35): hand and print together, down the arm's line and toward the viewer
    tl.add(() => engine.release(index), 1.5);
    tl.to(stage.pose, { ...pulled, duration: 0.6, ease: 'power2.inOut' }, 1.5);
    tl.to(stage.pose, { pull: 1, duration: 0.6, ease: 'power1.inOut' }, 1.5);
    // release (2.35-2.70): let go, and the arm retreats down its line, below the screen
    tl.add(() => stage.release(), 2.1);
    const retreat = along(ARM.pull * u + vh * 0.9, ARM.depth * u + ARM.pullDepth * u, lean + 5);
    tl.to(stage.pose, { ...retreat, x: retreat.x + inward, duration: 0.35, ease: 'power2.in' }, 2.1);
    // detail (2.50-3.10)
    tl.addLabel('detail', 2.25);
    addDetail(tl, p, 'detail', onDetail, 0.6);
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
  gsap.killTweensOf([p.print, ...p.others, p.paper, p.clone, p.slot, ...p.text]);
  p.arm?.stop();
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
