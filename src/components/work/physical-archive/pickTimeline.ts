import { gsap } from 'gsap';
import type { ArchiveEngine, PrintPose } from './useArchiveMotion';
import type { ArmStage } from './arm/armStage';
import { ARM, type ArmTransform } from './arm/armConfig';

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

/** the flight into the detail and the text arriving - shared by both paths */
function addDetail(tl: gsap.core.Timeline, p: PickParts, at: string, onDetail: () => void) {
  const b = base!;
  const box = slotBox(p.slot);
  tl.to(p.paper, { autoAlpha: 1, duration: 0.6, ease: 'power1.inOut' }, at);
  tl.to(
    p.clone,
    { x: box.cx - b.cx, y: box.cy - b.cy, scale: box.w / b.w, rotation: 0, duration: 0.85, ease: 'power3.inOut' },
    at,
  );
  tl.to(p.text, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, `${at}+=0.5`);
  tl.add(() => {
    gsap.set(p.slot, { autoAlpha: 1 });
    gsap.set(p.clone, { autoAlpha: 0 });
    onDetail();
  }, `${at}+=0.9`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The pick, as one performance:
 *   anticipation - the archive stops, the others recede, the print lifts; a beat
 *   emerge       - the arm rises from below the screen, quick, then slowing
 *   reach        - the last few centimetres, slow, a hair past the mark
 *   settle       - a small correction back onto it; fingers behind the print
 *   grab         - forward through the print's plane: the fingers close over
 *                  its edge, the print gives toward the hand and is attached
 *   pull         - off the rope (which recoils), down and toward the viewer
 *   release      - the hand lets go and retreats below the screen while the
 *                  same print flies on into the detail
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
  select.to(print, { y: -10, duration: 0.26, ease: 'power2.out' }, 0);
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
    const vh = innerHeight;
    const quick = innerWidth < 700 ? 0.85 : 1;
    // config distances are for a ~200px print; scale them to this one
    const u = pose.w / 200;
    const hand = pose.w * (innerWidth < 700 ? ARM.handPerPrintWidthMobile : ARM.handPerPrintWidth);
    stage.setPrint(clone, base!, hand);
    const grab = { x: pose.cx, y: pose.cy + pose.h / 2 - hand * ARM.gripAboveEdge };
    // one shoulder, below and right of the screen: the arm's lean comes from
    // where the print is relative to it, so a far print is reached across
    const portrait = vh > innerWidth;
    const [sx, sy] = portrait ? ARM.shoulderPortrait : ARM.shoulder;
    const shoulder = { x: innerWidth * sx, y: vh * sy };
    const lean = Math.max(-34, Math.min(34, (Math.atan2(shoulder.x - grab.x, shoulder.y - grab.y) * 180) / Math.PI));
    const slope = Math.tan((lean * Math.PI) / 180);
    const tilt = portrait ? ARM.tiltPortrait : 0;
    const at = (t: ArmTransform, y?: number) => {
      const ty = y ?? grab.y + t.position[1] * u;
      return {
        // below the screen the arm stays on its line from the shoulder
        x: grab.x + t.position[0] * u + (y === undefined ? 0 : (ty - grab.y) * slope),
        y: ty,
        z: t.position[2] * u,
        rx: t.rotation[0] + tilt,
        ry: t.rotation[1],
        rz: lean + t.rotation[2],
      };
    };
    gsap.set(stage.pose, { ...at(ARM.rest, vh + hand * 0.5), reach: 0, grip: 0, pull: 0 });
    stage.start();

    // screen-space choreography (where the arm is) with the GLB's own clips
    // (what the forearm and wrist do) laid over the same beats
    const tl = gsap.timeline({ onComplete: () => stage.stop() });
    tl.to(clone, { rotation: pose.angle * 0.3, duration: 0.45, ease: 'power2.out' }, 0);
    tl.to(stage.pose, { ...at(ARM.approach), duration: 0.62 * quick, ease: 'power2.out' }, 0);
    tl.to(stage.pose, { ...at(ARM.reach), duration: 0.42 * quick, ease: 'power3.out' });
    tl.to(stage.pose, { ...at(ARM.settle), duration: 0.2 * quick, ease: 'sine.inOut' });
    tl.to(stage.pose, { reach: 1, duration: 1.24 * quick, ease: 'power1.inOut' }, 0);
    tl.addLabel('grab', '+=0.06');
    tl.to(stage.pose, { ...at(ARM.grab), duration: 0.24, ease: 'power2.inOut' }, 'grab');
    tl.to(stage.pose, { grip: 1, duration: 0.42, ease: 'power1.inOut' }, 'grab');
    tl.to(clone, { y: 4 * u, rotation: 0, duration: 0.16, ease: 'power2.in' }, 'grab+=0.1');
    tl.add(() => stage.attach(), 'grab+=0.26');
    tl.addLabel('pull', 'grab+=0.34');
    tl.add(() => engine.release(index), 'pull');
    tl.to(stage.pose, { ...at(ARM.pull), duration: 0.6 * quick, ease: 'power2.inOut' }, 'pull');
    tl.to(stage.pose, { pull: 1, duration: 0.6 * quick, ease: 'power1.inOut' }, 'pull');
    tl.addLabel('detail', '>-0.04');
    tl.add(() => stage.release(), 'detail');
    tl.to(stage.pose, { ...at(ARM.exit, vh + hand * 1.4), duration: 0.55, ease: 'power2.in' }, 'detail+=0.04');
    addDetail(tl, p, 'detail', onDetail);
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
