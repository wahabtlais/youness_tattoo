/**
 * Studio time. Appointments are stored as instants (timestamptz, UTC) and
 * the studio works in Detroit: "11:00 on March 9" means 11:00 in Detroit,
 * whatever the time zone of the server or of the browser it was typed in.
 * Everything here goes through Date.UTC and Intl with an explicit time
 * zone - nothing reads the machine's local zone - so the same input gives
 * the same instant everywhere, across daylight-saving changes:
 *
 *   - a time that doesn't exist (the spring-forward gap, 2:00-3:00 on the
 *     second Sunday of March) moves forward past the gap (2:30 → 3:30 EDT);
 *   - a time that happens twice (the fall-back hour, 1:00-2:00 on the first
 *     Sunday of November) is its first occurrence (1:30 EDT, not EST).
 */

/** the studio's one time zone */
export const STUDIO_TIME_ZONE = 'America/Detroit';

export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormat = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string) {
  let f = partsFormat.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    partsFormat.set(timeZone, f);
  }
  return f;
}

/** an instant as the clock on the wall reads it in a time zone */
export function wallTime(instant: Date | string, timeZone = STUDIO_TIME_ZONE): WallTime & { second: number } {
  const p = Object.fromEntries(formatterFor(timeZone).formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

const two = (n: number) => String(n).padStart(2, '0');

/** the calendar date of an instant in a time zone: "2026-03-09" */
export function zonedDate(instant: Date | string, timeZone = STUDIO_TIME_ZONE) {
  const w = wallTime(instant, timeZone);
  return `${w.year}-${two(w.month)}-${two(w.day)}`;
}

/** the zone's offset from UTC at an instant, in minutes (Detroit: -300 in winter, -240 in summer) */
export function zoneOffsetMinutes(instant: Date | string, timeZone = STUDIO_TIME_ZONE) {
  const at = new Date(instant);
  at.setUTCMilliseconds(0);
  const w = wallTime(at, timeZone);
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - at.getTime()) / 60_000);
}

/**
 * A wall-clock date and time in a zone ("2026-03-09", "11:00") as an
 * instant - the gap and the repeated hour resolved as described above.
 */
export function zonedTimeToInstant(date: string, time: string, timeZone = STUDIO_TIME_ZONE): Date {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) throw new Error('Expected a date like 2026-03-09 and a time like 11:00');
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  // the offsets in force around that moment (a change is never closer than a day to both ends)
  const offsets = [...new Set([zoneOffsetMinutes(new Date(asUtc - 36 * 3_600_000), timeZone), zoneOffsetMinutes(new Date(asUtc), timeZone), zoneOffsetMinutes(new Date(asUtc + 36 * 3_600_000), timeZone)])];
  const matches = offsets
    .map((o) => asUtc - o * 60_000)
    .filter((c) => {
      const w = wallTime(new Date(c), timeZone);
      return w.year === y && w.month === mo && w.day === da && w.hour === h && w.minute === mi;
    });
  // the first occurrence of a repeated time; in a gap, the wall time read with the offset from before it
  if (matches.length) return new Date(Math.min(...matches));
  return new Date(asUtc - Math.min(...offsets) * 60_000);
}

/** a date plus whole days, as dates (no time zone involved): "2026-03-07" + 2 → "2026-03-09" */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${two(at.getUTCMonth() + 1)}-${two(at.getUTCDate())}`;
}

/** whole days from one date to another ("2026-03-07" → "2026-03-09" is 2) */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** an instant formatted as the clock reads in a zone (default: the studio's) */
export function formatInZone(instant: Date | string, opts: Intl.DateTimeFormatOptions, timeZone = STUDIO_TIME_ZONE, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(new Date(instant));
}

/** the zone's short name at an instant: "EST" / "EDT" for Detroit, "GMT+1" or "CET" elsewhere */
export function zoneName(instant: Date | string, timeZone = STUDIO_TIME_ZONE, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' }).formatToParts(new Date(instant)).find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}
