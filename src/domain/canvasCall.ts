import type { ImageAsset } from './media';

/**
 * A Canvas Call: a specific tattoo Younes wants to do, looking for the
 * person to wear it - often a design he has drawn, sometimes tied to a
 * convention, sometimes with an offer. Visitors respond through the
 * consultation, which carries the call with it (domain/consultation.ts).
 */
export type CanvasCallStatus = 'upcoming' | 'open' | 'booked' | 'closed';

export const CALL_STATUS_LABEL: Record<CanvasCallStatus, string> = {
  upcoming: 'Opening soon',
  open: 'Open',
  booked: 'Fully booked',
  closed: 'Closed',
};

/** only an open call takes responses */
export const callTakesResponses = (c: CanvasCall) => c.status === 'open';

/**
 * A call's status as of `today` (yyyy-mm-dd): an "open" call whose deadline
 * has passed is closed, whatever its record still says - so a stale record
 * can never keep offering a response.
 */
export const statusOn = (c: CanvasCall, today: string): CanvasCallStatus =>
  c.status === 'open' && c.deadline && c.deadline < today ? 'closed' : c.status;

/** what the call shows: Younes's design, a reference from his work, or a placeholder until there is one */
export type CanvasCallArtwork =
  | { kind: 'design'; image: ImageAsset; alt: string }
  | { kind: 'reference'; workId: string }
  | { kind: 'placeholder' };

export interface CanvasCall {
  /** marks a fictional call - no real offer, deadline or appointment - shown as such everywhere */
  demo?: true;
  /** URL segment for /canvas-calls/:slug */
  slug: string;
  title: string;
  /** a line for the lists */
  summary: string;
  /** the call in full, one paragraph per entry */
  description: string[];
  status: CanvasCallStatus;
  artwork: CanvasCallArtwork;
  /** where on the body, if decided */
  placement?: string;
  /** roughly how large, if known */
  scale?: string;
  /** the offer, exactly as Younes states it - absent when there is none */
  offer?: string;
  /** confirmed conditions only */
  eligibility?: string[];
  /** last day to respond, yyyy-mm-dd */
  deadline?: string;
  /** the journal post about its event (by slug) */
  eventSlug?: string;
  /** related pieces (by work id) */
  workIds?: string[];
}

export type CanvasCallsContent =
  | { status: 'awaiting' }
  | { status: 'demo'; calls: (CanvasCall & { demo: true })[] }
  | { status: 'published'; calls: CanvasCall[] };

/** the order calls are listed in: open first, then soon, then the rest */
const ORDER: Record<CanvasCallStatus, number> = { open: 0, upcoming: 1, booked: 2, closed: 3 };
export const byCallStatus = (a: CanvasCall, b: CanvasCall) => ORDER[a.status] - ORDER[b.status];
