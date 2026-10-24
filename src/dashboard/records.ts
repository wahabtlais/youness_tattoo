import type { ConsultationStatus } from '../domain/consultation';
import { STUDIO_ROOT } from './navigation';
import type { Appointment, FollowUp, InquiryRecord, Overview } from './types';

/**
 * The studio's records seen from other angles than the inquiry - derived
 * from the overview, never invented. A client is grouped by their record's
 * id; their contact details and notes are fetched with the client's own
 * record (/api/studio/clients/:id), not carried in the overview.
 */

/** where someone stands with the studio, from their inquiry's status */
export type Relationship = 'inquiry' | 'talking' | 'booked' | 'tattooed' | 'declined';

export const RELATIONSHIP: Record<Relationship, { label: string; tone: string; hint: string }> = {
  inquiry: { label: 'Awaiting answer', tone: 'attention', hint: 'Sent an idea that is new or still in review' },
  talking: { label: 'In conversation', tone: 'info', hint: 'Accepted, contacted, or asked for details' },
  booked: { label: 'Booked', tone: 'success', hint: 'Sessions being arranged or on the calendar' },
  tattooed: { label: 'Tattooed', tone: 'neutral', hint: 'The tattoo is done; aftercare may follow' },
  declined: { label: 'Declined', tone: 'neutral', hint: 'Not taken on' },
};

const RELATION_OF: Record<ConsultationStatus, Relationship> = {
  draft: 'inquiry',
  submitted: 'inquiry',
  'under-review': 'inquiry',
  'changes-requested': 'talking',
  accepted: 'talking',
  contacted: 'talking',
  booking: 'booked',
  completed: 'tattooed',
  declined: 'declined',
};

export interface ClientRecord {
  /** URL segment: /studio/clients/:id */
  id: string;
  name: string;
  relationship: Relationship;
  inquiries: InquiryRecord[];
  appointments: Appointment[];
  followUps: FollowUp[];
  /** first time the studio heard from them */
  since: string;
  /** the latest thing that happened with them, for sorting */
  lastAt: string;
}

/** "Sample client AF" -> "sample-client-af" */
export const clientId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** a client's key: their record's id, or (for anything without one) their name as a slug */
const keyOf = (r: { clientId?: string; clientName: string }) => r.clientId ?? clientId(r.clientName);
export const clientPath = (r: { clientId?: string; clientName: string }) => `${STUDIO_ROOT}/clients/${keyOf(r)}`;
export const inquiryPath = (q: InquiryRecord) => `${STUDIO_ROOT}/inquiries/${q.id}`;
/** the calendar's week holding a date (yyyy-mm-dd) */
export const calendarPath = (iso: string, view: 'week' | 'day' = 'day') => `${STUDIO_ROOT}/calendar?view=${view}&date=${localDay(new Date(iso))}`;

/** yyyy-mm-dd in local time */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** everyone in the records, most recent inquiry first */
export function clientsOf(o: Overview): ClientRecord[] {
  const by = new Map<string, ClientRecord>();
  const get = (r: { clientId?: string; clientName: string }, at: string) => {
    const id = keyOf(r);
    let c = by.get(id);
    if (!c) {
      c = { id, name: r.clientName, relationship: 'inquiry', inquiries: [], appointments: [], followUps: [], since: at, lastAt: at };
      by.set(id, c);
    }
    if (at < c.since) c.since = at;
    if (at > c.lastAt) c.lastAt = at;
    return c;
  };
  for (const q of o.inquiries) get(q, q.receivedAt).inquiries.push(q);
  for (const a of o.appointments) get(a, a.startsAt).appointments.push(a);
  for (const f of o.followUps) get(f, f.dueAt).followUps.push(f);
  for (const c of by.values()) {
    c.inquiries.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    c.appointments.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
    // the latest inquiry says where they stand
    if (c.inquiries[0]) c.relationship = RELATION_OF[c.inquiries[0].status];
  }
  // most recent inquiry first; people known only from the calendar or a follow-up after them
  const key = (c: ClientRecord) => c.inquiries[0]?.receivedAt ?? '';
  return [...by.values()].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
}

/** the inquiries that started from a portfolio piece (Find Similar), newest first */
export const inquiriesFromPiece = (o: Overview, workId: string) =>
  o.inquiries.filter((q) => q.entry.from === 'find-similar' && (q.entry.workId === workId || q.entry.selection?.references.includes(workId)));

/** the inquiries that answer a canvas call */
export const inquiriesForCall = (o: Overview, slug: string) => o.inquiries.filter((q) => q.entry.from === 'canvas-call' && q.entry.callSlug === slug);
