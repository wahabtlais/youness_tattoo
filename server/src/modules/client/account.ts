import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import type { AftercareStepRow } from '../../db/types.ts';
import { conflict, notFound } from '../../lib/errors.ts';
import { record, type Actor } from '../audit/service.ts';
import { enqueue } from '../notify/service.ts';
import { mediaUrl } from './portal.ts';

/**
 * A client's own data: what the studio holds about them (to review), a copy
 * of it (to download), and asking for the account to be closed.
 *
 * Closing is a request Younes reviews - nothing is deleted automatically.
 * No retention policy has been approved yet, so closing an account stops
 * it working (no sign-in, every session ended) and keeps the records -
 * appointments in particular - until a policy decides what can go. The
 * client is told exactly that, before they ask and after.
 */

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/** what's kept that a closed account doesn't remove, and why - said to the client as it is */
export const RETAINED = [
  'Appointments and their history - the studio’s calendar and business records.',
  'Requests you sent and the conversation about them, while a retention period for them is still being decided.',
  'The record that you asked for your account to be closed, and when.',
];

export async function dataSummary(db: Executor, account: { id: string; clientId: string }) {
  const [a, c, requests, messages, projects, images, healing, appointments, plans, deletion] = await Promise.all([
    db.selectFrom('client_accounts').select(['email', 'name', 'created_at', 'email_verified_at']).where('id', '=', account.id).executeTakeFirstOrThrow(),
    db.selectFrom('clients').select(['phone', 'instagram', 'preferred_contact']).where('id', '=', account.clientId).executeTakeFirstOrThrow(),
    count(db.selectFrom('inquiries').where('client_id', '=', account.clientId).where('anonymized_at', 'is', null)),
    count(db.selectFrom('client_messages').where('client_id', '=', account.clientId)),
    count(db.selectFrom('projects').where('client_id', '=', account.clientId)),
    count(
      db
        .selectFrom('project_media as pm')
        .innerJoin('projects as p', 'p.id', 'pm.project_id')
        .where('p.client_id', '=', account.clientId)
        .where('pm.added_by', '=', 'client'),
    ),
    count(db.selectFrom('healing_photos as h').innerJoin('projects as p', 'p.id', 'h.project_id').where('p.client_id', '=', account.clientId)),
    count(db.selectFrom('appointments').where('client_id', '=', account.clientId)),
    count(db.selectFrom('aftercare_plans as pl').innerJoin('projects as p', 'p.id', 'pl.project_id').where('p.client_id', '=', account.clientId)),
    db.selectFrom('client_account_requests').selectAll().where('account_id', '=', account.id).where('kind', '=', 'deletion').orderBy('requested_at', 'desc').executeTakeFirst(),
  ]);
  const requestImages = await count(
    db
      .selectFrom('inquiry_references as r')
      .innerJoin('inquiries as i', 'i.id', 'r.inquiry_id')
      .where('i.client_id', '=', account.clientId)
      .where('r.kind', '=', 'upload'),
  );
  return {
    account: { email: a.email, name: a.name, createdAt: iso(a.created_at), verifiedAt: iso(a.email_verified_at) },
    profile: { phone: c.phone, instagram: c.instagram, preferredContact: c.preferred_contact },
    counts: { requests, messages, projects, referenceImages: images + requestImages, healingPhotos: healing, appointments, aftercarePlans: plans },
    retained: RETAINED,
    deletion: deletion ? { status: deletion.status, requestedAt: iso(deletion.requested_at), resolvedAt: iso(deletion.resolved_at), resolution: deletion.resolution } : null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function count(q: any): Promise<number> {
  const r = await q.select((eb: any) => eb.fn.countAll().as('n')).executeTakeFirstOrThrow();
  return Number(r.n);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Everything the studio holds about this client, as one JSON document: the
 * account and profile, their requests (with what they sent), messages,
 * projects, appointments, aftercare and healing photos. Images are listed
 * by their private address (open while signed in), not embedded. The
 * studio's private notes about them are its own working notes and aren't
 * included - see the privacy notice (pending) for how those are handled.
 */
export async function exportData(db: DB, account: { id: string; clientId: string }) {
  const clientId = account.clientId;
  const [a, c, inquiries, refs, messages, projects, media, appointments, plans, photos] = await Promise.all([
    db.selectFrom('client_accounts').select(['email', 'name', 'created_at', 'email_verified_at']).where('id', '=', account.id).executeTakeFirstOrThrow(),
    db.selectFrom('clients').select(['name', 'phone', 'instagram', 'preferred_contact', 'created_at']).where('id', '=', clientId).executeTakeFirstOrThrow(),
    db.selectFrom('inquiries').select(['id', 'public_ref', 'kind', 'status', 'summary', 'contact', 'submitted_at', 'consent_at', 'privacy_notice_version']).where('client_id', '=', clientId).where('anonymized_at', 'is', null).orderBy('submitted_at').execute(),
    db.selectFrom('inquiry_references as r').innerJoin('inquiries as i', 'i.id', 'r.inquiry_id').select(['r.inquiry_id', 'r.media_id', 'r.note']).where('i.client_id', '=', clientId).where('r.kind', '=', 'upload').execute(),
    db.selectFrom('client_messages').select(['inquiry_id', 'project_id', 'author', 'body', 'created_at']).where('client_id', '=', clientId).orderBy('created_at').execute(),
    db.selectFrom('projects').select(['id', 'title', 'concept', 'description', 'placement', 'size', 'status', 'created_at']).where('client_id', '=', clientId).execute(),
    db.selectFrom('project_media as pm').innerJoin('projects as p', 'p.id', 'pm.project_id').select(['pm.project_id', 'pm.media_id', 'pm.kind', 'pm.added_by', 'pm.caption', 'pm.created_at']).where('p.client_id', '=', clientId).execute(),
    db.selectFrom('appointments').select(['kind', 'title', 'starts_at', 'ends_at', 'status', 'prep', 'project_id']).where('client_id', '=', clientId).orderBy('starts_at').execute(),
    db.selectFrom('aftercare_plans as pl').innerJoin('projects as p', 'p.id', 'pl.project_id').select(['pl.project_id', 'pl.title', 'pl.intro', 'pl.steps', 'pl.started_on', 'pl.reminders']).where('p.client_id', '=', clientId).execute(),
    db.selectFrom('healing_photos as h').innerJoin('projects as p', 'p.id', 'h.project_id').select(['h.project_id', 'h.media_id', 'h.note', 'h.submitted_at', 'h.response', 'h.responded_at']).where('p.client_id', '=', clientId).execute(),
  ]);
  await record(db, { type: 'website' }, 'client.data_exported', { type: 'client', id: clientId });
  return {
    exportedAt: new Date().toISOString(),
    about: 'Your data held by Younes Tattoo. Times are in UTC (ISO 8601); the studio works in Detroit time. Images are listed by their private address, which opens while you are signed in.',
    account: { email: a.email, name: a.name, createdAt: iso(a.created_at), emailVerifiedAt: iso(a.email_verified_at) },
    profile: { name: c.name, phone: c.phone, instagram: c.instagram, preferredContact: c.preferred_contact, since: iso(c.created_at) },
    requests: inquiries.map((q) => ({
      reference: q.public_ref,
      kind: q.kind,
      status: q.status,
      sentAt: iso(q.submitted_at),
      consentAt: iso(q.consent_at),
      privacyNoticeVersion: q.privacy_notice_version,
      whatYouSent: q.summary,
      contactAsSent: q.contact,
      images: refs.filter((r) => r.inquiry_id === q.id && r.media_id).map((r) => mediaUrl(r.media_id!)),
      messages: messages.filter((m) => m.inquiry_id === q.id).map((m) => ({ from: m.author === 'client' ? 'you' : 'Younes', at: iso(m.created_at), text: m.body })),
    })),
    projects: projects.map((p) => ({
      title: p.title,
      concept: p.concept,
      description: p.description,
      placement: p.placement,
      size: p.size,
      status: p.status,
      createdAt: iso(p.created_at),
      images: media.filter((m) => m.project_id === p.id).map((m) => ({ kind: m.kind, addedBy: m.added_by === 'client' ? 'you' : 'Younes', caption: m.caption, at: iso(m.created_at), address: mediaUrl(m.media_id) })),
      messages: messages.filter((m) => m.project_id === p.id).map((m) => ({ from: m.author === 'client' ? 'you' : 'Younes', at: iso(m.created_at), text: m.body })),
      aftercare: plans
        .filter((pl) => pl.project_id === p.id)
        .map((pl) => ({ title: pl.title, intro: pl.intro, startedOn: pl.started_on, reminders: pl.reminders, stages: pl.steps as AftercareStepRow[] })),
      healingPhotos: photos.filter((h) => h.project_id === p.id).map((h) => ({ at: iso(h.submitted_at), note: h.note, address: mediaUrl(h.media_id), answer: h.response, answeredAt: iso(h.responded_at) })),
    })),
    appointments: appointments.map((x) => ({ kind: x.kind, title: x.title, startsAt: iso(x.starts_at), endsAt: iso(x.ends_at), status: x.status, preparation: x.prep, project: projects.find((p) => p.id === x.project_id)?.title ?? null })),
  };
}

export async function requestDeletion(db: DB, config: Config, account: { id: string; clientId: string; name: string }, reason?: string) {
  const settings = await db.selectFrom('studio_settings').select('notify_email').executeTakeFirstOrThrow();
  const owner = await db.selectFrom('users').select('email').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst();
  const notify = settings.notify_email ?? owner?.email ?? null;
  try {
    return await db.transaction().execute(async (tx) => {
      const r = await tx.insertInto('client_account_requests').values({ account_id: account.id, kind: 'deletion', reason: reason ?? null }).returning(['id', 'requested_at']).executeTakeFirstOrThrow();
      await record(tx, { type: 'website' }, 'client_account.deletion_requested', { type: 'client', id: account.clientId }, { request: r.id });
      if (notify) await enqueue(tx, { to: notify, template: 'owner-account-request', payload: { name: account.name, link: `${config.PUBLIC_ORIGIN}/studio/clients/${account.clientId}` }, related: { type: 'client-account-request', id: r.id } });
      return { id: r.id, requestedAt: iso(r.requested_at) };
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw conflict('You’ve already asked for your account to be closed - Younes will review it.', 'already_requested');
    throw e;
  }
}

/** the client takes back a request that's still waiting */
export async function withdrawDeletion(db: DB, account: { id: string; clientId: string }) {
  const r = await db
    .updateTable('client_account_requests')
    .set({ status: 'cancelled', resolved_at: new Date(), resolution: 'Withdrawn by the client' })
    .where('account_id', '=', account.id)
    .where('kind', '=', 'deletion')
    .where('status', '=', 'pending')
    .returning('id')
    .executeTakeFirst();
  if (!r) throw notFound('There’s no request waiting.');
  await record(db, { type: 'website' }, 'client_account.deletion_withdrawn', { type: 'client', id: account.clientId }, { request: r.id });
}

// ---------------- the studio's review ----------------

export async function accountRequests(db: Executor, clientId?: string) {
  let q = db
    .selectFrom('client_account_requests as r')
    .innerJoin('client_accounts as a', 'a.id', 'r.account_id')
    .select(['r.id', 'r.kind', 'r.status', 'r.reason', 'r.requested_at', 'r.resolved_at', 'r.resolution', 'a.client_id', 'a.name'])
    .orderBy('r.requested_at', 'desc');
  if (clientId) q = q.where('a.client_id', '=', clientId);
  const rows = await q.execute();
  return rows.map((r) => ({ id: r.id, kind: r.kind, status: r.status, reason: r.reason, requestedAt: iso(r.requested_at), resolvedAt: iso(r.resolved_at), resolution: r.resolution, clientId: r.client_id, name: r.name }));
}

/**
 * Younes's answer to a closing request: close the account (it stops
 * working; every session ends; the records stay until a retention policy is
 * approved) or cancel the request (e.g. after talking it through).
 */
export async function resolveAccountRequest(db: DB, actor: Actor & { type: 'user' }, id: string, action: 'close' | 'cancel', note?: string) {
  await db.transaction().execute(async (tx) => {
    const r = await tx.selectFrom('client_account_requests').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
    if (!r) throw notFound('That request doesn’t exist.');
    if (r.status !== 'pending') throw conflict('That request has already been answered.', 'not_pending');
    const now = new Date();
    if (action === 'close') {
      await tx.updateTable('client_accounts').set({ disabled_at: now }).where('id', '=', r.account_id).execute();
      await tx.updateTable('client_sessions').set({ revoked_at: now }).where('account_id', '=', r.account_id).where('revoked_at', 'is', null).execute();
    }
    const resolution = note ?? (action === 'close' ? 'Account closed. Records kept until a retention policy is approved.' : 'Request cancelled.');
    await tx.updateTable('client_account_requests').set({ status: action === 'close' ? 'completed' : 'cancelled', resolved_at: now, resolved_by: actor.id, resolution }).where('id', '=', id).execute();
    const a = await tx.selectFrom('client_accounts').select('client_id').where('id', '=', r.account_id).executeTakeFirstOrThrow();
    await record(tx, actor, action === 'close' ? 'client_account.closed' : 'client_account.deletion_cancelled', { type: 'client', id: a.client_id ?? r.account_id }, { request: id });
  });
}
