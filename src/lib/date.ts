/** dates on the site: "March 12, 2027" - from yyyy-mm-dd, never shifted by the time zone */
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const long = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

export const formatDate = (iso: string) => long.format(parse(iso));

/** "March 12–14, 2027", "March 30 – April 2, 2027", or one day */
export function formatRange(start: string, end?: string) {
  if (!end || end === start) return formatDate(start);
  const [a, b] = [parse(start), parse(end)];
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${monthDay.format(a)}–${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  return `${monthDay.format(a)} – ${monthDay.format(b)}, ${b.getUTCFullYear()}`;
}

/** today as yyyy-mm-dd, local */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** an event's dates set as a calendar does: "12–14" over "March 2027" (or "30–2" over "March – April 2027") */
export function dateParts(start: string, end?: string) {
  const [a, b] = [parse(start), parse(end ?? start)];
  const month = (d: Date) => monthName.format(d);
  const days = a.getTime() === b.getTime() ? `${a.getUTCDate()}` : `${a.getUTCDate()}–${b.getUTCDate()}`;
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return { days, month: `${month(a)} ${a.getUTCFullYear()} – ${month(b)} ${b.getUTCFullYear()}` };
  return { days, month: a.getUTCMonth() === b.getUTCMonth() ? `${month(a)} ${a.getUTCFullYear()}` : `${month(a)} – ${month(b)} ${a.getUTCFullYear()}` };
}
