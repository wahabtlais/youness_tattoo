import { sql } from 'kysely';
import type { DB, Executor } from '../../db/index.ts';
import { notFound } from '../../lib/errors.ts';
import { record, recent, type Actor } from '../audit/service.ts';

/**
 * Clients, follow-ups and the dashboard's overview. The overview is the
 * shape the dashboard's pages already read (src/dashboard/types.ts:
 * Overview) - now from the database, every row carrying `demo` so sample
 * records stay labelled.
 */

const iso = (d: Date | string) => new Date(d).toISOString();

export async function overview(db: Executor, now = new Date()) {
  const since = new Date(now.getTime() - 400 * 86_400_000);
  const [inquiries, appointments, followUps, activity] = await Promise.all([
    db
      .selectFrom('inquiries as i')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .select(['i.id', 'i.public_ref', 'i.status', 'i.submitted_at', 'i.entry', 'i.summary', 'i.demo', 'c.id as client_id', 'c.name'])
      .where('i.submitted_at', '>=', since)
      .orderBy('i.submitted_at', 'desc')
      .limit(2000)
      .execute(),
    db
      .selectFrom('appointments as a')
      .innerJoin('clients as c', 'c.id', 'a.client_id')
      .select(['a.id', 'a.kind', 'a.title', 'a.starts_at', 'a.ends_at', 'a.status', 'a.prep', 'a.demo', 'a.inquiry_id', 'c.id as client_id', 'c.name'])
      .where('a.status', 'in', ['proposed', 'confirmed'])
      .where('a.ends_at', '>=', new Date(now.getTime() - 60 * 86_400_000))
      .orderBy('a.starts_at')
      .execute(),
    db
      .selectFrom('follow_ups as f')
      .innerJoin('clients as c', 'c.id', 'f.client_id')
      .select(['f.id', 'f.kind', 'f.reason', 'f.due_at', 'f.demo', 'f.inquiry_id', 'c.id as client_id', 'c.name'])
      .where('f.done_at', 'is', null)
      .orderBy('f.due_at')
      .execute(),
    recent(db, 20),
  ]);
  return {
    demo: inquiries.some((q) => q.demo),
    inquiries: inquiries.map((q) => ({
      id: q.id,
      publicRef: q.public_ref,
      clientId: q.client_id,
      clientName: q.name,
      status: q.status,
      receivedAt: iso(q.submitted_at),
      entry: q.entry,
      summary: { references: [], ...(q.summary as object) },
      demo: q.demo,
    })),
    appointments: appointments.map((a) => ({
      id: a.id,
      clientId: a.client_id,
      clientName: a.name,
      inquiryId: a.inquiry_id,
      kind: a.kind,
      title: a.title,
      startsAt: iso(a.starts_at),
      endsAt: iso(a.ends_at),
      status: a.status,
      prep: a.prep ?? undefined,
      demo: a.demo,
    })),
    followUps: followUps.map((f) => ({ id: f.id, clientId: f.client_id, clientName: f.name, inquiryId: f.inquiry_id, kind: f.kind, reason: f.reason, dueAt: iso(f.due_at), demo: f.demo })),
    activity: activity.map((a) => ({ id: a.id, at: a.at, actor: a.actor === 'system' ? 'website' : a.actor, text: a.text })),
  };
}

export async function clientDetail(db: Executor, id: string) {
  const c = await db.selectFrom('clients').selectAll().where('id', '=', id).executeTakeFirst();
  if (!c) throw notFound('That client doesn’t exist.');
  const [notes, followUps, activity] = await Promise.all([
    db.selectFrom('notes').select(['id', 'body', 'source', 'created_at']).where('client_id', '=', id).orderBy('created_at', 'desc').execute(),
    db.selectFrom('follow_ups').selectAll().where('client_id', '=', id).orderBy('due_at').execute(),
    recent(db, 30, { type: 'client', id }),
  ]);
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    instagram: c.instagram,
    preferredContact: c.preferred_contact,
    demo: c.demo,
    anonymized: !!c.anonymized_at,
    createdAt: iso(c.created_at),
    notes: notes.map((n) => ({ id: n.id, body: n.body, source: n.source, createdAt: iso(n.created_at) })),
    followUps: followUps.map((f) => ({ id: f.id, kind: f.kind, reason: f.reason, dueAt: iso(f.due_at), doneAt: f.done_at ? iso(f.done_at) : null, inquiryId: f.inquiry_id, demo: f.demo })),
    activity,
  };
}

export async function updateClient(
  db: DB,
  actor: Actor & { type: 'user' },
  id: string,
  patch: { name?: string; phone?: string | null; instagram?: string | null; preferredContact?: 'email' | 'phone' | 'instagram' | null },
) {
  await db.transaction().execute(async (tx) => {
    const r = await tx
      .updateTable('clients')
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(patch.instagram !== undefined ? { instagram: patch.instagram?.replace(/^@/, '') || null } : {}),
        ...(patch.preferredContact !== undefined ? { preferred_contact: patch.preferredContact } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('anonymized_at', 'is', null)
      .executeTakeFirst();
    if (Number(r.numUpdatedRows) === 0) throw notFound();
    // which fields changed, never their values
    await record(tx, actor, 'client.updated', { type: 'client', id }, { fields: Object.keys(patch) });
  });
}

export async function createFollowUp(db: DB, actor: Actor & { type: 'user' }, input: { clientId: string; inquiryId?: string; kind: 'reply' | 'reminder' | 'aftercare'; reason: string; dueAt: string }) {
  return db.transaction().execute(async (tx) => {
    if (!(await tx.selectFrom('clients').select('id').where('id', '=', input.clientId).executeTakeFirst())) throw notFound('That client doesn’t exist.');
    const f = await tx
      .insertInto('follow_ups')
      .values({ client_id: input.clientId, inquiry_id: input.inquiryId ?? null, kind: input.kind, reason: input.reason, due_at: input.dueAt })
      .returning('id')
      .executeTakeFirstOrThrow();
    await record(tx, actor, 'follow_up.created', { type: 'client', id: input.clientId }, { followUp: f.id, kind: input.kind });
    return f.id;
  });
}

export async function setFollowUpDone(db: DB, actor: Actor & { type: 'user' }, id: string, done: boolean) {
  await db.transaction().execute(async (tx) => {
    const f = await tx.updateTable('follow_ups').set({ done_at: done ? new Date() : null }).where('id', '=', id).returning('client_id').executeTakeFirst();
    if (!f) throw notFound();
    await record(tx, actor, done ? 'follow_up.done' : 'follow_up.reopened', { type: 'client', id: f.client_id }, { followUp: id });
  });
}

// ---------------- settings ----------------

export async function settings(db: Executor) {
  const s = await db.selectFrom('studio_settings').selectAll().executeTakeFirstOrThrow();
  return {
    studioName: s.studio_name,
    timezone: s.timezone,
    notifyEmail: s.notify_email,
    retentionMonths: s.retention_months,
    aiDailyBudgetUsd: Number(s.ai_daily_budget_usd),
    aiMonthlyBudgetUsd: Number(s.ai_monthly_budget_usd),
  };
}

export async function updateSettings(
  db: DB,
  actor: Actor & { type: 'user' },
  patch: { studioName?: string; timezone?: string; notifyEmail?: string | null; retentionMonths?: number; aiDailyBudgetUsd?: number; aiMonthlyBudgetUsd?: number },
) {
  if (patch.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: patch.timezone });
    } catch {
      const { badRequest } = await import('../../lib/errors.ts');
      throw badRequest('Unknown time zone.', { timezone: 'Use a name like America/Detroit' });
    }
  }
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('studio_settings')
      .set({
        ...(patch.studioName !== undefined ? { studio_name: patch.studioName } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.notifyEmail !== undefined ? { notify_email: patch.notifyEmail } : {}),
        ...(patch.retentionMonths !== undefined ? { retention_months: patch.retentionMonths } : {}),
        ...(patch.aiDailyBudgetUsd !== undefined ? { ai_daily_budget_usd: patch.aiDailyBudgetUsd } : {}),
        ...(patch.aiMonthlyBudgetUsd !== undefined ? { ai_monthly_budget_usd: patch.aiMonthlyBudgetUsd } : {}),
        updated_at: new Date(),
      })
      .execute();
    await record(tx, actor, 'settings.updated', { type: 'settings', id: '1' }, { fields: Object.keys(patch) });
  });
}

export const clientCount = (db: Executor) => db.selectFrom('clients').select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow();
