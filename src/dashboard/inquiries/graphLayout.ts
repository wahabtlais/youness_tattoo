/**
 * The inquiry map's two fixed layouts of one hierarchy - the consultation's
 * own lifecycle (domain/consultation.ts: submitted → under-review →
 * accepted | changes-requested | declined → contacted → booking →
 * completed), All inquiries at its head, the active stages grouped, the
 * closed outcomes apart. No edge crosses another in either.
 *
 * - tall: top to bottom. The main path runs down the middle; In review
 *   branches sideways to Needs details (left) and Declined (right, in the
 *   closed column); Booking leads right to Completed. For squarer canvases.
 * - wide: left to right. The main path runs along the middle; Needs details
 *   sits above In review, the closed outcomes in a lane below. For wide
 *   canvases.
 *
 * The map uses whichever lets its nodes be drawn larger in the canvas it
 * has (InquiryGraph). Coordinates are graph units; the canvas fits them.
 */

export const NODE_W = 204;
export const NODE_H = 92;
const PAD = 24;
/** room above a region's nodes for its name */
const HEAD = 38;

export type LayoutName = 'tall' | 'wide';
type Side = 'top' | 'bottom' | 'left' | 'right';

export interface LifecycleEdge {
  source: string;
  target: string;
  /** which side each end attaches to */
  from: Side;
  to: Side;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** where the region's name sits - away from the edges that enter it */
  label: 'top' | 'bottom';
}

export interface Layout {
  positions: Record<string, { x: number; y: number }>;
  groups: { active: Rect; closed: Rect };
  edges: LifecycleEdge[];
  /** the whole map's extent, for choosing between the layouts */
  size: { w: number; h: number };
}

/** a region around nodes: from one node's top-left to another's bottom-right, its name above or below them */
const around = (a: { x: number; y: number }, b: { x: number; y: number }, label: 'top' | 'bottom' = 'top'): Rect => ({
  x: a.x - PAD,
  y: a.y - (label === 'top' ? HEAD : PAD),
  w: b.x + NODE_W - a.x + 2 * PAD,
  h: b.y + NODE_H - a.y + HEAD + PAD,
  label,
});

const tall = (): Layout => {
  const col = { left: 0, center: 256, right: 536 };
  const row = (n: number) => n * 120;
  const p = {
    all: { x: col.center, y: row(0) - 20 },
    new: { x: col.center, y: row(1) },
    'needs-details': { x: col.left, y: row(2) },
    'in-review': { x: col.center, y: row(2) },
    declined: { x: col.right, y: row(2) },
    accepted: { x: col.center, y: row(3) },
    contacted: { x: col.center, y: row(4) },
    booking: { x: col.center, y: row(5) },
    completed: { x: col.right, y: row(5) },
  };
  return {
    positions: p,
    groups: { active: around({ x: col.left, y: row(1) }, p.booking), closed: around(p.declined, p.completed) },
    edges: [
      { source: 'all', target: 'new', from: 'bottom', to: 'top' },
      { source: 'new', target: 'in-review', from: 'bottom', to: 'top' },
      { source: 'in-review', target: 'needs-details', from: 'left', to: 'right' },
      { source: 'in-review', target: 'declined', from: 'right', to: 'left' },
      { source: 'in-review', target: 'accepted', from: 'bottom', to: 'top' },
      { source: 'accepted', target: 'contacted', from: 'bottom', to: 'top' },
      { source: 'contacted', target: 'booking', from: 'bottom', to: 'top' },
      { source: 'booking', target: 'completed', from: 'right', to: 'left' },
    ],
    size: { w: col.right + NODE_W + 2 * PAD, h: row(5) + NODE_H + 20 + PAD },
  };
};

const wide = (): Layout => {
  const col = (n: number) => n * 248;
  const row = { above: 0, main: 172, closed: 360 };
  const p = {
    all: { x: col(0), y: row.main },
    new: { x: col(1), y: row.main },
    'in-review': { x: col(2), y: row.main },
    'needs-details': { x: col(2), y: row.above },
    accepted: { x: col(3), y: row.main },
    contacted: { x: col(4), y: row.main },
    booking: { x: col(5), y: row.main },
    declined: { x: col(2), y: row.closed },
    completed: { x: col(5), y: row.closed },
  };
  return {
    positions: p,
    groups: { active: around({ x: col(1), y: row.above }, p.booking), closed: around(p.declined, p.completed, 'bottom') },
    edges: [
      { source: 'all', target: 'new', from: 'right', to: 'left' },
      { source: 'new', target: 'in-review', from: 'right', to: 'left' },
      { source: 'in-review', target: 'needs-details', from: 'top', to: 'bottom' },
      { source: 'in-review', target: 'declined', from: 'bottom', to: 'top' },
      { source: 'in-review', target: 'accepted', from: 'right', to: 'left' },
      { source: 'accepted', target: 'contacted', from: 'right', to: 'left' },
      { source: 'contacted', target: 'booking', from: 'right', to: 'left' },
      { source: 'booking', target: 'completed', from: 'bottom', to: 'top' },
    ],
    size: { w: col(5) + NODE_W + PAD, h: row.closed + NODE_H + HEAD + PAD },
  };
};

export const LAYOUTS: Record<LayoutName, Layout> = { tall: tall(), wide: wide() };

/** the layout whose nodes come out larger in a canvas of this size (the fit's zoom) */
export function bestLayout(w: number, h: number): LayoutName {
  const zoom = (l: Layout) => Math.min(w / l.size.w, h / l.size.h);
  return zoom(LAYOUTS.wide) > zoom(LAYOUTS.tall) ? 'wide' : 'tall';
}
