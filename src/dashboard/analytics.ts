import type { ConsultationStatus } from '../domain/consultation';
import { daysFrom } from './format';
import { calendarPath, clientPath } from './records';
import type { Appointment, AppointmentKind, Overview } from './types';

/**
 * Every figure on the Overview, counted from the records - the KPI cards,
 * the charts, the attention queue - so they always agree with each other
 * and with the lists. Nothing here is typed in by hand.
 */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** the calendar day `n` days after the date's (by the calendar, not 24-hour steps: a clock change can't shift it) */
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** whole days since the date (0 today) */
const daysSince = (now: Date, iso: string) => -daysFrom(now, iso);

/** the pipeline's order, as an inquiry moves through it (drafts never reach the studio) */
export const PIPELINE: { status: ConsultationStatus; open: boolean }[] = [
  { status: 'submitted', open: true },
  { status: 'under-review', open: true },
  { status: 'changes-requested', open: true },
  { status: 'contacted', open: true },
  { status: 'accepted', open: true },
  { status: 'booking', open: true },
  { status: 'completed', open: false },
  { status: 'declined', open: false },
];
const BOOKED: ConsultationStatus[] = ['booking', 'completed'];

/** the window the Overview covers */
export const WINDOW_WEEKS = 12;

export interface Kpis {
  newInquiries: number;
  /** days the oldest new inquiry has waited */
  oldestNewDays?: number;
  receivedThisWeek: number;
  receivedWeekBefore: number;
  upcoming: number;
  upcomingHours: number;
  nextAppointment?: Appointment;
  followUps: number;
  overdue: number;
  dueToday: number;
  booked: number;
  received: number;
  /** booked ÷ received in the window, 0..1 */
  conversion: number;
}

export function kpis(o: Overview, now: Date): Kpis {
  const fresh = o.inquiries.filter((q) => q.status === 'submitted');
  const week = (from: number) => o.inquiries.filter((q) => daysSince(now, q.receivedAt) >= from && daysSince(now, q.receivedAt) < from + 7).length;
  const ahead = upcoming(o, now, Infinity);
  const booked = o.inquiries.filter((q) => BOOKED.includes(q.status)).length;
  return {
    newInquiries: fresh.length,
    oldestNewDays: fresh.length ? Math.max(...fresh.map((q) => daysSince(now, q.receivedAt))) : undefined,
    receivedThisWeek: week(0),
    receivedWeekBefore: week(7),
    upcoming: ahead.length,
    upcomingHours: Math.round(ahead.reduce((h, a) => h + hours(a), 0) * 10) / 10,
    nextAppointment: ahead[0],
    followUps: o.followUps.length,
    overdue: o.followUps.filter((f) => daysFrom(now, f.dueAt) < 0).length,
    dueToday: o.followUps.filter((f) => daysFrom(now, f.dueAt) === 0).length,
    booked,
    received: o.inquiries.length,
    conversion: o.inquiries.length ? booked / o.inquiries.length : 0,
  };
}

export type ActivityPeriod = 'weeks' | 'days';
export interface SeriesPoint {
  /** the first and last day of the bucket (the same day, per day) */
  date: Date;
  end: Date;
  value: number;
}

/** inquiries received per week (the last 12) or per day (the last 30) */
export function inquirySeries(o: Overview, now: Date, period: ActivityPeriod): SeriesPoint[] {
  const today = startOfDay(now);
  const size = period === 'weeks' ? 7 : 1;
  const count = period === 'weeks' ? WINDOW_WEEKS : 30;
  return Array.from({ length: count }, (_, i) => {
    const back = (count - 1 - i) * size;
    const date = plusDays(today, -(back + size - 1));
    const value = o.inquiries.filter((q) => {
      const d = daysSince(now, q.receivedAt);
      return d >= back && d < back + size;
    }).length;
    return { date, end: plusDays(today, -back), value };
  });
}

/** a series in three figures: its latest bucket, the average, and the busiest */
export function seriesStats(series: SeriesPoint[]) {
  const total = series.reduce((n, p) => n + p.value, 0);
  const peak = series.reduce((best, p) => (p.value > best.value ? p : best), series[0]);
  return { total, latest: series[series.length - 1], average: series.length ? total / series.length : 0, peak };
}

export interface PipelineRow {
  status: ConsultationStatus;
  open: boolean;
  count: number;
  share: number;
}
export function pipeline(o: Overview): { rows: PipelineRow[]; total: number; open: number } {
  const total = o.inquiries.length;
  const rows = PIPELINE.map(({ status, open }) => {
    const count = o.inquiries.filter((q) => q.status === status).length;
    return { status, open, count, share: total ? count / total : 0 };
  });
  return { rows, total, open: rows.filter((r) => r.open).reduce((n, r) => n + r.count, 0) };
}

export const hours = (a: Appointment) => (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 3_600_000;

export interface WorkloadDay {
  date: Date;
  hours: number;
  appointments: Appointment[];
  byKind: Record<AppointmentKind, number>;
}
/** the next seven days, today first: hours booked and what they are */
export function workload(o: Overview, now: Date): WorkloadDay[] {
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = plusDays(today, i);
    const appointments = o.appointments.filter((a) => daysFrom(now, a.startsAt) === i).sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
    const byKind = { session: 0, consultation: 0, aftercare: 0 };
    appointments.forEach((a) => byKind[a.kind]++);
    return { date, appointments, byKind, hours: Math.round(appointments.reduce((h, a) => h + hours(a), 0) * 10) / 10 };
  });
}

/** appointments not yet over, in the next seven days, soonest first */
export function upcoming(o: Overview, now: Date, limit: number) {
  return o.appointments
    .filter((a) => new Date(a.endsAt) >= now && daysFrom(now, a.startsAt) < 7)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
    .slice(0, limit);
}

export type Urgency = 'overdue' | 'today' | 'waiting' | 'prepare' | 'confirm' | 'new';
export interface AttentionItem {
  id: string;
  urgency: Urgency;
  /** what to do */
  title: string;
  /** who, and a word of context */
  detail: string;
  /** when, in words ("2 days overdue", "Tomorrow, 10:00 AM") */
  when?: string;
  /** for ordering: lower first */
  rank: number;
  /** where to deal with it: the inquiry itself, or the part of the studio it belongs to */
  to: string;
}

/**
 * What needs Younes, most urgent first: overdue follow-ups, today's,
 * inquiries left waiting, appointments to prepare or confirm, then the new
 * inquiries as one line (they're counted, not repeated).
 */
export function attention(o: Overview, now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const f of o.followUps) {
    const d = daysFrom(now, f.dueAt);
    if (d < 0) items.push({ id: f.id, urgency: 'overdue', title: f.reason, detail: f.clientName, when: `${-d} day${d === -1 ? '' : 's'} overdue`, rank: 0 + d / 100, to: clientPath(f) });
    else if (d === 0) items.push({ id: f.id, urgency: 'today', title: f.reason, detail: f.clientName, when: 'Due today', rank: 1, to: clientPath(f) });
  }
  const fresh = o.inquiries.filter((q) => q.status === 'submitted');
  for (const q of fresh.filter((q) => daysSince(now, q.receivedAt) >= 3)) {
    const d = daysSince(now, q.receivedAt);
    items.push({ id: q.id, urgency: 'waiting', title: 'New inquiry waiting for review', detail: `${q.clientName} · ${q.summary.concept ?? 'No idea described'}`, when: `Waiting ${d} days`, rank: 2 - d / 100, to: `/studio/inquiries/new/${q.id}` });
  }
  for (const a of upcoming(o, now, Infinity)) {
    const d = daysFrom(now, a.startsAt);
    if (a.prep && d <= 2) items.push({ id: `${a.id}-prep`, urgency: 'prepare', title: a.prep, detail: `${a.clientName} · ${a.title}`, when: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In 2 days', rank: 3 + d / 10, to: calendarPath(a.startsAt) });
    if (a.status === 'proposed') items.push({ id: `${a.id}-confirm`, urgency: 'confirm', title: `Confirm the ${a.kind}`, detail: `${a.clientName} · ${a.title}`, when: `In ${d} day${d === 1 ? '' : 's'}`, rank: 4 + d / 10, to: calendarPath(a.startsAt) });
  }
  const recent = fresh.filter((q) => daysSince(now, q.receivedAt) < 3).length;
  if (recent) items.push({ id: 'new', urgency: 'new', title: `${recent} new ${recent === 1 ? 'inquiry' : 'inquiries'} to review`, detail: 'Arrived in the last 3 days', rank: 5, to: '/studio/inquiries/new' });
  return items.sort((a, b) => a.rank - b.rank);
}

/** ticks for a count axis: 0 and clean steps up to at least `max` */
export function countTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const step = [1, 2, 5, 10, 20, 50].find((s) => s >= raw) ?? Math.ceil(raw / 10) * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}
