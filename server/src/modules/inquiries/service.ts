import { sql } from 'kysely';
import { INQUIRY_STATUSES, type ConsultationReceipt, type ConsultationSubmissionParsed, type InquiryStatus } from '@younes/contracts';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import { publicRef } from '../../lib/crypto.ts';
import { ipHash } from '../../lib/crypto.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { record, type Actor } from '../audit/service.ts';
import { enqueue } from '../notify/service.ts';

/**
 * Consultations from the website, and the inquiries they become.
 *
 * Submitting is one transaction: the client (found by email, or created),
 * the inquiry, its references, the history entry and both emails (to the
 * studio, and a receipt to the client) are written together - or nothing
 * is, and the visitor is told it didn't go through. The answer "received"
 * comes only after the commit. The draft's id is the idempotency key, so a
 * double click or a retried request files it once.
 */

/** a person needs a few seconds at least to fill in a consultation */
const MIN_FILL_MS = 3000;

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  submitted: 'New',
  'under-review': 'In review',
  'changes-requested': 'Needs details',
  accepted: 'Accepted',
  declined: 'Declined',
  contacted: 'Contacted',
  booking: 'Booking',
  completed: 'Completed',
};

async function receiptFor(db: Executor, key: string, email: string): Promise<ConsultationReceipt | null> {
  const found = await db
    .selectFrom('inquiries as i')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .select(['i.public_ref', 'i.submitted_at', 'c.email'])
    .where('i.idempotency_key', '=', key)
    .executeTakeFirst();
  if (!found) return null;
  // the same draft id with someone else's email isn't a repeat - it's a clash
  if (found.email && found.email !== email) throw conflict('This consultation was already sent. Please refresh the page to start a new one.', 'idempotency_mismatch');
  return { receiptId: found.public_ref, receivedAt: new Date(found.submitted_at).toISOString(), duplicate: true };
}

export async function submitConsultation(
  db: DB,
  config: Config,
  input: ConsultationSubmissionParsed,
  meta: { ip: string; userAgent?: string; now: Date },
): Promise<ConsultationReceipt> {
  // a field people never see, filled in: a bot
  if (input.website) throw badRequest('This consultation couldn’t be sent.', { _: 'Rejected' });
  if (input.startedAt && meta.now.getTime() - new Date(input.startedAt).getTime() < MIN_FILL_MS) {
    throw badRequest('That was very quick - please check your answers and send it again.', { _: 'Too fast' });
  }
  const repeat = await receiptFor(db, input.idempotencyKey, input.contact.email);
  if (repeat) return repeat;

  const settings = await db.selectFrom('studio_settings').selectAll().executeTakeFirstOrThrow();
  const owner = await db.selectFrom('users').select('email').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst();
  const notify = settings.notify_email ?? owner?.email ?? null;

  try {
    return await db.transaction().execute(async (tx) => {
      const c = input.contact;
      // one record per person: an existing client (by email) gains this inquiry; their details aren't overwritten
      let client = await tx.selectFrom('clients').select(['id', 'phone', 'instagram']).where('email', '=', c.email).where('anonymized_at', 'is', null).executeTakeFirst();
      if (!client) {
        client = await tx
          .insertInto('clients')
          .values({ name: c.name, email: c.email, phone: c.phone ?? null, instagram: c.instagram ?? null })
          .returning(['id', 'phone', 'instagram'])
          .executeTakeFirstOrThrow();
      } else if ((!client.phone && c.phone) || (!client.instagram && c.instagram)) {
        await tx
          .updateTable('clients')
          .set({ phone: client.phone ?? c.phone ?? null, instagram: client.instagram ?? c.instagram ?? null, updated_at: new Date() })
          .where('id', '=', client.id)
          .execute();
      }

      const ref = publicRef();
      const inquiry = await tx
        .insertInto('inquiries')
        .values({
          public_ref: ref,
          client_id: client.id,
          status: 'submitted',
          entry: JSON.stringify(input.entry) as never,
          summary: JSON.stringify({ ...input.summary, references: [] }) as never,
          contact: JSON.stringify(c) as never,
          idempotency_key: input.idempotencyKey,
          consent_at: meta.now,
          privacy_notice_version: input.privacyNoticeVersion,
          ip_hash: ipHash(meta.ip, config.TOTP_ENC_KEY, meta.now.toISOString().slice(0, 10)),
          user_agent: meta.userAgent?.slice(0, 300) ?? null,
          submitted_at: meta.now,
        })
        .returning(['id', 'submitted_at'])
        .executeTakeFirstOrThrow();

      // the pieces they brought from Find Similar, in order: the one they started from, then those kept
      if (input.entry.from === 'find-similar') {
        const numbers = [input.entry.workId, ...(input.entry.selection?.references ?? [])].map(Number);
        await tx
          .insertInto('inquiry_references')
          .values(numbers.map((n, i) => ({ inquiry_id: inquiry.id, kind: 'work' as const, work_number: n, note: i === 0 ? 'Started from this piece in Find Similar' : 'Kept in Find Similar', position: i })))
          .execute();
      }

      await record(tx, { type: 'website' }, 'inquiry.submitted', { type: 'inquiry', id: inquiry.id }, { ref, entry: input.entry.from });
      const link = `${config.PUBLIC_ORIGIN}/studio/inquiries/${inquiry.id}`;
      if (notify) await enqueue(tx, { to: notify, template: 'inquiry-received-owner', payload: { name: c.name, ref, concept: input.summary.concept ?? '', link }, related: { type: 'inquiry', id: inquiry.id } });
      await enqueue(tx, { to: c.email, template: 'inquiry-receipt-client', payload: { name: c.name, ref }, related: { type: 'inquiry', id: inquiry.id } });

      return { receiptId: ref, receivedAt: new Date(inquiry.submitted_at).toISOString(), duplicate: false };
    });
  } catch (e) {
    // two identical requests at the same moment: the second finds the first's receipt
    if ((e as { code?: string }).code === '23505' && String((e as { constraint?: string }).constraint).includes('idempotency')) {
      const again = await receiptFor(db, input.idempotencyKey, input.contact.email);
      if (again) return again;
    }
    throw e;
  }
}

// ---------------- the studio's side ----------------

export async function setStatus(db: DB, actor: Actor, id: string, status: InquiryStatus, note?: string) {
  if (!INQUIRY_STATUSES.includes(status)) throw badRequest('Unknown status');
  return db.transaction().execute(async (tx) => {
    const before = await tx.selectFrom('inquiries').select(['status', 'client_id']).where('id', '=', id).where('anonymized_at', 'is', null).forUpdate().executeTakeFirst();
    if (!before) throw notFound('That inquiry doesn’t exist.');
    if (before.status === status) return { changed: false };
    await tx.updateTable('inquiries').set({ status, updated_at: new Date() }).where('id', '=', id).execute();
    if (note) await tx.insertInto('notes').values({ inquiry_id: id, body: note, author_id: 'id' in actor ? (actor.id ?? null) : null }).execute();
    await record(tx, actor, 'inquiry.status', { type: 'inquiry', id }, { from: before.status, status, label: STATUS_LABEL[status] });
    return { changed: true };
  });
}

export async function addNote(db: DB, actor: Actor & { type: 'user' }, target: { inquiryId?: string; clientId?: string }, body: string) {
  return db.transaction().execute(async (tx) => {
    if (target.inquiryId && !(await tx.selectFrom('inquiries').select('id').where('id', '=', target.inquiryId).executeTakeFirst())) throw notFound();
    if (target.clientId && !(await tx.selectFrom('clients').select('id').where('id', '=', target.clientId).executeTakeFirst())) throw notFound();
    const note = await tx
      .insertInto('notes')
      .values({ inquiry_id: target.inquiryId ?? null, client_id: target.clientId ?? null, body, author_id: actor.id })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();
    await record(tx, actor, target.inquiryId ? 'inquiry.note' : 'client.note', target.inquiryId ? { type: 'inquiry', id: target.inquiryId } : { type: 'client', id: target.clientId! });
    return { id: note.id, createdAt: new Date(note.created_at).toISOString() };
  });
}

export async function inquiryDetail(db: Executor, id: string) {
  const q = await db
    .selectFrom('inquiries as i')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .select([
      'i.id',
      'i.public_ref',
      'i.status',
      'i.entry',
      'i.summary',
      'i.contact',
      'i.submitted_at',
      'i.consent_at',
      'i.privacy_notice_version',
      'i.demo',
      'i.anonymized_at',
      'c.id as client_id',
      'c.name as client_name',
      'c.email',
      'c.phone',
      'c.instagram',
    ])
    .where('i.id', '=', id)
    .executeTakeFirst();
  if (!q) throw notFound('That inquiry doesn’t exist.');
  const [notes, references, proposals] = await Promise.all([
    db.selectFrom('notes').select(['id', 'body', 'source', 'created_at']).where('inquiry_id', '=', id).orderBy('created_at', 'desc').execute(),
    db.selectFrom('inquiry_references').select(['kind', 'work_number', 'note', 'url', 'position']).where('inquiry_id', '=', id).orderBy('position').execute(),
    db.selectFrom('ai_proposals').select(['id', 'task', 'content', 'status', 'model', 'created_at', 'decided_at']).where('inquiry_id', '=', id).orderBy('created_at', 'desc').execute(),
  ]);
  return {
    id: q.id,
    publicRef: q.public_ref,
    status: q.status,
    entry: q.entry,
    summary: q.summary,
    receivedAt: new Date(q.submitted_at).toISOString(),
    consentAt: q.consent_at ? new Date(q.consent_at).toISOString() : null,
    privacyNoticeVersion: q.privacy_notice_version,
    demo: q.demo,
    anonymized: !!q.anonymized_at,
    client: { id: q.client_id, name: q.client_name, email: q.email, phone: q.phone, instagram: q.instagram },
    notes: notes.map((n) => ({ id: n.id, body: n.body, source: n.source, createdAt: new Date(n.created_at).toISOString() })),
    references: references.map((r) => ({ kind: r.kind, workId: r.work_number ? String(r.work_number).padStart(2, '0') : null, note: r.note, url: r.url })),
    proposals: proposals.map((p) => ({ id: p.id, task: p.task, content: p.content, status: p.status, model: p.model, createdAt: new Date(p.created_at).toISOString(), decidedAt: p.decided_at ? new Date(p.decided_at).toISOString() : null })),
  };
}

/**
 * Retention: a client whose every inquiry is closed (declined or
 * completed) and who has had no update for the configured months is
 * anonymised in place - their contact details and the free text of their
 * ideas are cleared, the record and its counts remain. The history keeps
 * ids only, so nothing personal survives there either.
 */
export async function applyRetention(db: DB, now = new Date()) {
  const settings = await db.selectFrom('studio_settings').select('retention_months').executeTakeFirstOrThrow();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - settings.retention_months);
  return db.transaction().execute(async (tx) => {
    const due = await tx
      .selectFrom('clients as c')
      .select('c.id')
      .where('c.anonymized_at', 'is', null)
      .where('c.updated_at', '<', cutoff)
      .where((eb) => eb.not(eb.exists(eb.selectFrom('inquiries as i').select('i.id').whereRef('i.client_id', '=', 'c.id').where((e) => e.or([e('i.status', 'not in', ['declined', 'completed']), e('i.updated_at', '>=', cutoff)])))))
      .where((eb) => eb.not(eb.exists(eb.selectFrom('appointments as a').select('a.id').whereRef('a.client_id', '=', 'c.id').where('a.ends_at', '>=', cutoff))))
      .execute();
    if (!due.length) return 0;
    const ids = due.map((d) => d.id);
    await tx.updateTable('clients').set({ name: 'Anonymised client', email: null, phone: null, instagram: null, anonymized_at: now, updated_at: now }).where('id', 'in', ids).execute();
    await tx
      .updateTable('inquiries')
      .set({ contact: JSON.stringify({}) as never, summary: JSON.stringify({ references: [] }) as never, ip_hash: null, user_agent: null, anonymized_at: now })
      .where('client_id', 'in', ids)
      .execute();
    await tx.deleteFrom('notes').where((eb) => eb.or([eb('client_id', 'in', ids), eb('inquiry_id', 'in', eb.selectFrom('inquiries').select('id').where('client_id', 'in', ids))])).execute();
    for (const id of ids) await record(tx, { type: 'system' }, 'client.anonymized', { type: 'client', id }, { retentionMonths: settings.retention_months });
    return ids.length;
  });
}

export const countOpen = (db: Executor) =>
  db
    .selectFrom('inquiries')
    .select(sql<number>`count(*)::int`.as('n'))
    .where('status', 'not in', ['declined', 'completed'])
    .executeTakeFirstOrThrow();

