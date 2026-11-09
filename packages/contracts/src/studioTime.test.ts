import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, STUDIO_TIME_ZONE, wallTime, zonedDate, zonedTimeToInstant, zoneName, zoneOffsetMinutes } from './studioTime.ts';

/**
 * Studio time: the same wall-clock time gives the same instant whatever
 * the machine's own time zone (run this file under TZ=Asia/Tokyo or
 * TZ=Pacific/Auckland - it must pass unchanged), and daylight-saving
 * changes resolve as documented.
 */
describe('studio time (America/Detroit)', () => {
  it('is Detroit', () => expect(STUDIO_TIME_ZONE).toBe('America/Detroit'));

  it('turns a winter and a summer wall time into the right instants', () => {
    expect(zonedTimeToInstant('2026-01-15', '11:00').toISOString()).toBe('2026-01-15T16:00:00.000Z'); // EST, UTC-5
    expect(zonedTimeToInstant('2026-07-15', '11:00').toISOString()).toBe('2026-07-15T15:00:00.000Z'); // EDT, UTC-4
  });

  it('moves a time in the spring-forward gap forward past it', () => {
    // 2026-03-08: 2:00 → 3:00. 2:30 doesn't exist; it becomes 3:30 EDT
    const t = zonedTimeToInstant('2026-03-08', '02:30');
    expect(t.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(wallTime(t)).toMatchObject({ hour: 3, minute: 30 });
    // the times either side are exact
    expect(zonedTimeToInstant('2026-03-08', '01:59').toISOString()).toBe('2026-03-08T06:59:00.000Z');
    expect(zonedTimeToInstant('2026-03-08', '03:00').toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });

  it('takes the first of a time that happens twice in the fall-back hour', () => {
    // 2026-11-01: 2:00 EDT → 1:00 EST. 1:30 happens at 05:30Z (EDT) and 06:30Z (EST)
    expect(zonedTimeToInstant('2026-11-01', '01:30').toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(zonedTimeToInstant('2026-11-01', '02:30').toISOString()).toBe('2026-11-01T07:30:00.000Z');
  });

  it('reads instants back as Detroit wall time, date and zone name', () => {
    expect(wallTime('2026-03-09T15:00:00Z')).toMatchObject({ year: 2026, month: 3, day: 9, hour: 11, minute: 0 });
    // late evening in Detroit is already tomorrow in UTC
    expect(zonedDate('2026-06-01T02:30:00Z')).toBe('2026-05-31');
    expect(zoneOffsetMinutes('2026-01-01T12:00:00Z')).toBe(-300);
    expect(zoneOffsetMinutes('2026-07-01T12:00:00Z')).toBe(-240);
    expect(zoneName('2026-01-01T12:00:00Z')).toBe('EST');
    expect(zoneName('2026-07-01T12:00:00Z')).toBe('EDT');
  });

  it('round-trips every quarter hour of a day across both changes', () => {
    for (const day of ['2026-03-08', '2026-11-01', '2026-06-21']) {
      for (let m = 0; m < 24 * 60; m += 15) {
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const t = zonedTimeToInstant(day, time);
        const w = wallTime(t);
        const gap = day === '2026-03-08' && m >= 120 && m < 180;
        if (!gap) expect(`${zonedDate(t)} ${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`).toBe(`${day} ${time}`);
      }
    }
  });

  it('counts dates without any time zone', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});
