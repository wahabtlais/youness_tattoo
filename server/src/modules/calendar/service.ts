import type { AppointmentStatus } from '@younes/contracts';
import { sql } from 'kysely';
import type { DB, Executor } from '../../db/index.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { record, type Actor } from '../audit/service.ts';

/**
 * Appointments. Times are stored as instants (timestamptz, UTC) and shown
 * in the studio's time zone (studio_settings.timezone) by the dashboard;
 * the API takes ISO times with their offset, so "11:00 in Detroit" is one
 * unambiguous moment across daylight-saving changes.
 *
 * A proposed or a confirmed appointment holds its slot. The database
 * refuses an overlap (appointments_no_overlap) - checked by Postgres
 * itself, so two requests racing for the same hour can't both succeed.
 * That refusal becomes a 409 with a plain message. Appointment writes
 * also take one transaction-scoped lock, so they run one at a time:
 * overlapping requests checked at the same instant would otherwise deadlock
 * on each other's constraint checks (a 500). One studio's bookings never
 * queue long enough to notice. A proposed time is a
 * suggestion to the client; confirmed is agreed - both shown distinctly.
 */

const iso = (d: Date | string) => new Date(d).toISOString();

const slotTaken = () => new AppError(409, 'slot_taken', 'That time overlaps another appointment that’s proposed or confirmed. Choose another time, or cancel the other one first.');

function translate(e: unknown): never {
  const err = e as { code?: string; constraint?: string };
  if (err.code === '23P01' && err.constraint === 'appointments_no_overlap') throw slotTaken();
  if (err.code === '23514' && err.constraint === 'appointments_ends_after_start') throw new AppError(400, 'validation', 'The end must be after the start.', { endsAt: 'Must be after the start' });
  throw e;
}

/** appointment writes, one at a time (see above); released at commit or rollback */
const APPOINTMENTS_LOCK = 0x59545f41; // "YT_A"
const lockAppointments = (tx: Executor) => sql`select pg_advisory_xact_lock(${APPOINTMENTS_LOCK})`.execute(tx);

export async function list(db: Executor, from: Date, to: Date) {
  const rows = await db
    .selectFrom('appointments as a')
    .innerJoin('clients as c', 'c.id', 'a.client_id')
    .selectAll('a')
    .select('c.name')
    .where('a.starts_at', '<', to)
    .where('a.ends_at', '>', from)
    .orderBy('a.starts_at')
    .execute();
  return rows.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    clientName: a.name,
    inquiryId: a.inquiry_id,
    kind: a.kind,
    title: a.title,
    startsAt: iso(a.starts_at),
    endsAt: iso(a.ends_at),
    status: a.status,
    prep: a.prep,
    demo: a.demo,
  }));
}

export async function create(
  db: DB,
  actor: Actor & { type: 'user' },
  input: { clientId: string; inquiryId?: string; kind: 'session' | 'consultation' | 'aftercare'; title: string; startsAt: string; endsAt: string; status: 'proposed' | 'confirmed'; prep?: string },
) {
  try {
    return await db.transaction().execute(async (tx) => {
      await lockAppointments(tx);
      if (!(await tx.selectFrom('clients').select('id').where('id', '=', input.clientId).where('anonymized_at', 'is', null).executeTakeFirst())) throw notFound('That client doesn’t exist.');
      const a = await tx
        .insertInto('appointments')
        .values({ client_id: input.clientId, inquiry_id: input.inquiryId ?? null, kind: input.kind, title: input.title, starts_at: input.startsAt, ends_at: input.endsAt, status: input.status, prep: input.prep ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      await record(tx, actor, 'appointment.created', { type: 'client', id: input.clientId }, { appointment: a.id, kind: input.kind, status: input.status });
      return a.id;
    });
  } catch (e) {
    translate(e);
  }
}

export async function update(db: DB, actor: Actor & { type: 'user' }, id: string, patch: { startsAt?: string; endsAt?: string; status?: AppointmentStatus; title?: string; prep?: string | null }) {
  try {
    await db.transaction().execute(async (tx) => {
      await lockAppointments(tx);
      const a = await tx
        .updateTable('appointments')
        .set({
          ...(patch.startsAt ? { starts_at: patch.startsAt } : {}),
          ...(patch.endsAt ? { ends_at: patch.endsAt } : {}),
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.title ? { title: patch.title } : {}),
          ...(patch.prep !== undefined ? { prep: patch.prep } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning('client_id')
        .executeTakeFirst();
      if (!a) throw notFound('That appointment doesn’t exist.');
      await record(tx, actor, 'appointment.updated', { type: 'client', id: a.client_id }, { appointment: id, status: patch.status, moved: !!(patch.startsAt || patch.endsAt) });
    });
  } catch (e) {
    translate(e);
  }
}

export async function availability(db: Executor) {
  const rows = await db.selectFrom('availability').selectAll().orderBy('weekday').orderBy('start_time').execute();
  return rows.map((r) => ({ weekday: r.weekday, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));
}

export async function setAvailability(db: DB, actor: Actor & { type: 'user' }, windows: { weekday: number; start: string; end: string }[]) {
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom('availability').execute();
    if (windows.length) await tx.insertInto('availability').values(windows.map((w) => ({ weekday: w.weekday, start_time: w.start, end_time: w.end }))).execute();
    await record(tx, actor, 'availability.updated', { type: 'settings', id: 'availability' }, { windows: windows.length });
  });
}
