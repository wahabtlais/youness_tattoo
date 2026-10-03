/**
 * The arm's performance, as tunable numbers. Positions are relative to the
 * grab point on the selected print (its bottom edge, centre), in CSS px;
 * +x right, +y DOWN (screen), +z toward the viewer. Rotations in degrees:
 * rx tips the forearm toward the viewer, rz leans the arm in the screen
 * plane (on top of the lean from the shoulder toward the print). One
 * "hand length" is the wrist-to-fingertip length.
 */
export interface ArmTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export const ARM = {
  /**
   * Hand length relative to the print's width: big enough to hold it, no
   * bigger. A real hand is ~1.9x a 4x5" print; a little less reads better,
   * and less again on a phone, where the arm would otherwise fill the screen.
   */
  handPerPrintWidth: 1.6,
  handPerPrintWidthMobile: 1.3,
  /** the pinch: the slice of the hand where thumb and fingers meet (fraction of hand length from the fingertips) */
  gripFromTip: 0.5,
  /** how far above its bottom edge the print is pinched (fraction of hand length) */
  gripAboveEdge: 0.1,

  /** the reaching person's shoulder, as a fraction of the viewport (below the screen, right of centre) */
  shoulder: [0.62, 1.9] as [number, number],
  /**
   * On a tall screen (phone, portrait tablet) the person stands to the
   * right: the arm comes up from the lower right corner, so the upper arm
   * (and the model's cut end) always leaves past the right edge.
   */
  shoulderPortrait: [1.5, 1.8] as [number, number],
  /** a little extra tip toward the viewer on a tall screen */
  tiltPortrait: -6,

  /** below the screen, on the line from the shoulder, still turned a little */
  rest: { position: [30, 0, 40], rotation: [-14, 0, 5] } as ArmTransform, // y is set from the viewport
  /** most of the reach, quick: just short of and below the print */
  approach: { position: [26, 56, -70], rotation: [-17, 0, 2] } as ArmTransform,
  /** the last few centimetres, slow, a hair past the mark */
  reach: { position: [-3, -4, -74], rotation: [-18, 0, -0.5] } as ArmTransform,
  /** the correction back onto the mark: the whole hand still behind the print */
  settle: { position: [0, 0, -70], rotation: [-18, 0, 0] } as ArmTransform,
  /** grab: forward through the print's plane, so the fingers close over its face from behind */
  grab: { position: [0, -6, 2], rotation: [-13, 0, 0] } as ArmTransform,
  /** pull: off the rope, down and toward the viewer */
  pull: { position: [-10, 150, 170], rotation: [-6, 0, -4] } as ArmTransform,
  /** release and retreat: drops away below the screen */
  exit: { position: [40, 0, 120], rotation: [-24, 0, 6] } as ArmTransform, // y is set from the viewport

  /**
   * Turned so the outer forearm faces the viewer: the sleeve (the only
   * tattooed side of the model) stays in view, and the hand meets the print
   * edge-on, so its fingers can pass behind it and then close over it.
   */
  yaw: -50,
};
