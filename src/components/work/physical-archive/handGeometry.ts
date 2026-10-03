/**
 * Geometry of the temporary hand (PickingHand), in its 240 x 1800 viewBox.
 * A replacement hand asset must provide the same three points.
 */
/** the forearm runs far down so it always leaves the bottom of the screen */
export const HAND_VIEWBOX = { w: 240, h: 1800 };
/** thumb tip when closed - lands on the print, just above its edge */
export const PINCH = { x: 76, y: 176 };
/** the print's bottom edge sits this far below the pinch */
export const EDGE_BELOW_PINCH = 22;
/** the thumb's pivot, for opening/closing it */
export const THUMB_PIVOT = '64 392';
