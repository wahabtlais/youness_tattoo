import type { BookingStatus } from '../domain/client';
import type { ConsultationEntry, ConsultationStatus, ConsultationSummary } from '../domain/consultation';

/**
 * What the private dashboard reads. View shapes, not the database: when an
 * API exists it returns these (or the hook maps to them), and the screens
 * don't change. Dates are ISO 8601.
 */

/**
 * An inquiry as the dashboard sees it: a submitted consultation - the
 * public form's own shapes (domain/consultation.ts), so nothing here is a
 * field the website doesn't collect. Contact details (`ClientContact`) are
 * not collected by the form yet, so a record carries only a display name.
 */
export interface InquiryRecord {
  id: string;
  /** the receipt reference the client was given (YT-…) */
  publicRef?: string;
  clientId?: string;
  /** a fictional sample record - labelled wherever it appears */
  demo?: boolean;
  /** a labelled sample name in the demo ("Sample client K") */
  clientName: string;
  status: ConsultationStatus;
  receivedAt: string;
  /** where on the website it started: a general way in, Find Similar (with its picks) or a canvas call */
  entry: ConsultationEntry;
  /** the answers, as the consultation form collects them */
  summary: ConsultationSummary;
}

export type AppointmentKind = 'session' | 'consultation' | 'aftercare';

export interface Appointment {
  id: string;
  clientId?: string;
  inquiryId?: string | null;
  demo?: boolean;
  clientName: string;
  kind: AppointmentKind;
  /** e.g. "Session 2 of 3 · upper arm, black and grey" */
  title: string;
  startsAt: string;
  endsAt: string;
  /** the booking's state: proposed (still to confirm) or confirmed */
  status: Extract<BookingStatus, 'proposed' | 'confirmed'> | 'completed' | 'cancelled' | 'no_show';
  /** something to get ready beforehand, if any */
  prep?: string;
}

export type FollowUpKind = 'reply' | 'reminder' | 'aftercare';

/** something Younes owes someone, or a reminder he set */
export interface FollowUp {
  id: string;
  clientId?: string;
  inquiryId?: string | null;
  demo?: boolean;
  clientName: string;
  kind: FollowUpKind;
  reason: string;
  dueAt: string;
}

/** who did something: Younes, the assistant (always on his approval), the website */
export type ActivityActor = 'you' | 'assistant' | 'website';

export interface ActivityItem {
  id: string;
  at: string;
  actor: ActivityActor;
  text: string;
}

export interface Overview {
  /** some records are fictional samples (each carries its own demo flag): the UI says so */
  demo: boolean;
  /** every inquiry received in the window the Overview covers (the last 12 weeks) */
  inquiries: InquiryRecord[];
  appointments: Appointment[];
  followUps: FollowUp[];
  activity: ActivityItem[];
}
