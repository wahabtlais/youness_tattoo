import type { ConsultationStatus } from '../domain/consultation';

/**
 * The dashboard's words for time and status - from the data and the local
 * clock, never hardcoded.
 */

const LOCALE = 'en-US';
const time = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const longDay = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });
const monthDay = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
const full = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full', timeStyle: 'short' });

const DAY = 24 * 60 * 60_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** whole calendar days from today to the date (0 today, 1 tomorrow, -1 yesterday) */
export const daysFrom = (now: Date, iso: string) => Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY);

/** "11:00 AM" */
export const clock = (iso: string) => time.format(new Date(iso));
/** "Friday, October 23" */
export const dayTitle = (d: Date) => longDay.format(d);
/** "Oct 23" */
export const shortDate = (d: Date) => monthDay.format(d);
/** "Fri" */
export const shortWeekday = (d: Date) => weekdayShort.format(d);
/** "Thursday, October 23, 2026 at 11:00 AM" - for a title attribute */
export const fullDate = (iso: string) => full.format(new Date(iso));

/** "just now", "42 min ago", "5 h ago", "yesterday", "6 days ago" */
export function ago(now: Date, iso: string) {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const days = -daysFrom(now, iso);
  if (days === 0) return `${Math.round(minutes / 60)} h ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "Today", "Tomorrow", "Yesterday", "Saturday", or a date further off */
export function dayName(now: Date, iso: string) {
  const days = daysFrom(now, iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return weekdayLong.format(new Date(iso));
  return longDay.format(new Date(iso));
}

/** "Good morning" / "Good afternoon" / "Good evening", by the local hour */
export function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "3", "1 inquiry" / "3 inquiries" */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const STATUS_LABEL: Record<ConsultationStatus, string> = {
  draft: 'Draft',
  submitted: 'New',
  'under-review': 'In review',
  'changes-requested': 'Needs details',
  accepted: 'Accepted',
  declined: 'Declined',
  contacted: 'Contacted',
  booking: 'Booking',
  completed: 'Completed',
};
