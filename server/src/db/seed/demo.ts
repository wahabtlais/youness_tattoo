import { sql } from 'kysely';
import { HOLDS_SLOT, lockAppointments, overlaps } from '../../modules/calendar/service.ts';
import type { DB } from '../index.ts';

/**
 * The dashboard's sample records: fictional clients, inquiries,
 * appointments and follow-ups for trying the studio out. Every row is
 * `demo = true` and shown as "Sample"; the clients have no contact details,
 * so nothing can be sent to them and no real consultation joins them (that
 * goes by email).
 *
 * Both operations are safe on a live studio and safe to run again:
 *
 * `addDemo` only inserts. It never runs the public content import, adds
 * nothing if sample inquiries are already there, skips any sample
 * appointment whose time a real one holds, and writes no history
 * (activity_log is append-only: an entry could never be taken out again)
 * unless asked to - the development seed does, for the overview's feed.
 *
 * `removeDemo` deletes sample rows only, in one transaction. A sample client
 * that has gained anything real - an inquiry, an appointment, a follow-up,
 * or a real record pointing at one of its sample inquiries - is kept with
 * everything attached to it, and listed, for the studio to sort out by hand.
 * The notes written on the removed samples go with them.
 *
 * Real bookings never wait on samples either way: the calendar cancels a
 * sample appointment that stands in a real one's way (calendar/service.ts).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** production needs an explicit --production: sample records are never added or removed there by accident */
export function assertDemoAllowed(isProd: boolean, args: string[]) {
  if (isProd && !args.includes('--production'))
    throw new Error('This is the production database. Add --production to confirm: sample records are flagged demo, and demo:remove --production takes them out again.');
}

export interface DemoAdded {
  added: boolean;
  inquiries: number;
  clients: number;
  appointments: number;
  followUps: number;
  activity: number;
  /** sample appointments left out because a real one holds that time */
  skipped: { title: string; startsAt: string }[];
}

export async function addDemo(db: DB, opts: { now?: Date; activity?: boolean } = {}): Promise<DemoAdded> {
  const { demoOverview } = await import('../../../../src/dashboard/data/demoOverview.ts');
  const o = demoOverview(opts.now ?? new Date());
  const result: DemoAdded = { added: false, inquiries: 0, clients: 0, appointments: 0, followUps: 0, activity: 0, skipped: [] };

  return db.transaction().execute(async (tx) => {
    // the calendar's own lock: no real booking can land between the check and the insert
    await lockAppointments(tx);
    const present = await tx
      .selectFrom('inquiries')
      .select(sql<number>`count(*)::int`.as('n'))
      .where((eb) => eb.or([eb('demo', '=', true), eb('public_ref', 'like', 'DEMO-%')]))
      .executeTakeFirstOrThrow();
    if (present.n > 0) return result;

    const clientOf = new Map<string, string>();
    const client = async (name: string) => {
      if (!clientOf.has(name)) {
        const r = await tx.insertInto('clients').values({ name, demo: true }).returning('id').executeTakeFirstOrThrow();
        clientOf.set(name, r.id);
      }
      return clientOf.get(name)!;
    };
    const inquiryOf = new Map<string, string>();
    for (const [i, q] of o.inquiries.entries()) {
      const r = await tx
        .insertInto('inquiries')
        .values({
          public_ref: `DEMO-${pad(i + 1)}`,
          client_id: await client(q.clientName),
          status: q.status,
          entry: JSON.stringify(q.entry) as never,
          summary: JSON.stringify(q.summary) as never,
          contact: JSON.stringify({ name: q.clientName }) as never,
          demo: true,
          submitted_at: q.receivedAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      inquiryOf.set(q.clientName, r.id);
    }
    for (const a of o.appointments) {
      // one at a time: a clash leaves out this sample, never the rest
      if (HOLDS_SLOT.includes(a.status) && (await tx.selectFrom('appointments').select('id').where('status', 'in', HOLDS_SLOT).where(overlaps(a.startsAt, a.endsAt)).executeTakeFirst())) {
        result.skipped.push({ title: a.title, startsAt: a.startsAt });
        continue;
      }
      await tx
        .insertInto('appointments')
        .values({
          client_id: await client(a.clientName),
          inquiry_id: inquiryOf.get(a.clientName) ?? null,
          kind: a.kind,
          title: a.title,
          starts_at: a.startsAt,
          ends_at: a.endsAt,
          status: a.status,
          prep: a.prep ?? null,
          demo: true,
        })
        .execute();
      result.appointments++;
    }
    for (const f of o.followUps) {
      await tx
        .insertInto('follow_ups')
        .values({ client_id: await client(f.clientName), inquiry_id: inquiryOf.get(f.clientName) ?? null, kind: f.kind, reason: f.reason, due_at: f.dueAt, demo: true })
        .execute();
      result.followUps++;
    }
    if (opts.activity)
      for (const a of o.activity) {
        await tx
          .insertInto('activity_log')
          .values({ at: a.at as never, actor_type: a.actor === 'you' ? 'user' : a.actor, action: 'demo.event', subject_type: null, subject_id: null, data: JSON.stringify({ text: a.text, demo: true }) as never })
          .execute();
        result.activity++;
      }
    return { ...result, added: true, inquiries: o.inquiries.length, clients: clientOf.size };
  });
}

export interface DemoRemoved {
  clients: number;
  inquiries: number;
  appointments: number;
  followUps: number;
  /** notes the studio wrote on the removed samples */
  notes: number;
  /** sample clients kept because something real is attached to them */
  kept: { id: string; name: string }[];
}

export async function removeDemo(db: DB): Promise<DemoRemoved> {
  return db.transaction().execute(async (tx) => {
    await lockAppointments(tx);
    const clients = (
      await sql<{ id: string; name: string; keep: boolean }>`
        select c.id, c.name, (
          exists (select 1 from inquiries i where i.client_id = c.id and not i.demo)
          or exists (select 1 from appointments a where not a.demo and (a.client_id = c.id or a.inquiry_id in (select id from inquiries where client_id = c.id)))
          or exists (select 1 from follow_ups f where not f.demo and (f.client_id = c.id or f.inquiry_id in (select id from inquiries where client_id = c.id)))
        ) as keep
        from clients c
        where c.demo
        order by c.name`.execute(tx)
    ).rows;
    const kept = clients.filter((c) => c.keep).map(({ id, name }) => ({ id, name }));
    const ids = clients.filter((c) => !c.keep).map((c) => c.id);
    if (!ids.length) return { clients: 0, inquiries: 0, appointments: 0, followUps: 0, notes: 0, kept };

    const inquiryIds = tx.selectFrom('inquiries').select('id').where('client_id', 'in', ids);
    const notes = await tx
      .selectFrom('notes')
      .select(sql<number>`count(*)::int`.as('n'))
      .where((eb) => eb.or([eb('client_id', 'in', ids), eb('inquiry_id', 'in', inquiryIds)]))
      .executeTakeFirstOrThrow();
    // every row below is a sample (a real one would have kept its client); `demo` is checked again regardless,
    // and a real inquiry or appointment left on a client would make the client's delete fail (on delete restrict)
    const followUps = await tx.deleteFrom('follow_ups').where('client_id', 'in', ids).where('demo', '=', true).executeTakeFirst();
    const appointments = await tx.deleteFrom('appointments').where('client_id', 'in', ids).where('demo', '=', true).executeTakeFirst();
    const inquiries = await tx.deleteFrom('inquiries').where('client_id', 'in', ids).where('demo', '=', true).executeTakeFirst();
    const removed = await tx.deleteFrom('clients').where('id', 'in', ids).where('demo', '=', true).executeTakeFirst();
    return {
      clients: Number(removed.numDeletedRows),
      inquiries: Number(inquiries.numDeletedRows),
      appointments: Number(appointments.numDeletedRows),
      followUps: Number(followUps.numDeletedRows),
      notes: notes.n,
      kept,
    };
  });
}
