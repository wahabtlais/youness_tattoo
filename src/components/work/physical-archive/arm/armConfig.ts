/**
 * The arm's performance, as tunable numbers.
 *
 * Staging: the hand reaches an EDGE of the selected print - a contact point
 * low and to the right - coming in on a diagonal from the bottom right. It
 * stays in front of the print the whole time (the forearm tips away, behind
 * it), stops at the contact point, and the PRINT comes to the hand. The
 * hand never crosses the print's plane, so it never reads as passing
 * through the photograph.
 *
 * Distances are CSS px for a ~200px-wide print and scale with the print.
 * "Along the arm" means along the line from the contact point back toward
 * the shoulder (down and to the right).
 */
export const ARM = {
  /** where the fingertips meet the print, as a fraction of its width / height */
  contact: { x: 0.78, y: 0.8 },

  /**
   * Hand length (wrist to fingertip) relative to the print's width: able to
   * hold it, not dominating it.
   */
  handPerPrintWidth: 1.3,
  handPerPrintWidthMobile: 1.08,
  /** the point of the hand that touches the print: the finger pads, just short of the tips */
  gripFromTip: 0.06,

  /** the reaching person's shoulder, as a fraction of the viewport (below the screen, right) */
  shoulder: [1.25, 1.7] as [number, number],
  /** on a tall screen the shoulder is further right, so the arm always leaves past the right edge */
  shoulderPortrait: [1.5, 1.8] as [number, number],
  /** the arm's lean toward the print stays within this range (degrees), wherever the print is */
  lean: { min: 15, max: 30 },

  /** in front of the print's plane (px); the forearm tips away from the viewer by `tilt` degrees */
  depth: 24,
  tilt: 8,
  /** yaw that shows the back of the hand and the sleeve */
  yaw: -28,

  /**
   * The reach's curve: it starts this much (fraction of its length) further
   * right and heads straight up out of the bottom of the screen, then bends
   * onto the arm's line.
   */
  curve: 0.12,
  /** the arm's extra lean at the start of the reach, settled out by contact (degrees) */
  turn: 5,
  /** how far the print comes to the hand, along the arm, and how much it turns (degrees) */
  give: 14,
  giveTurn: -1.5,
  /** the pull: along the arm and toward the viewer */
  pull: 130,
  pullDepth: 140,
  /** ...and drawn this fraction of the way toward the middle of the screen, so a print near an edge is brought in, not dragged off */
  pullToCentre: 0.25,
};
