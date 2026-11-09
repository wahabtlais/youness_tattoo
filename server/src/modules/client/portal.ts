import { CLIENT_REQUEST_STATUS, daysBetween, PROJECT_STATUS_LABEL, STUDIO_TIME_ZONE, zonedDate, type InquiryStatus, type ProjectStatus } from '@younes/contracts';
import type { z } from 'zod';
import type { clientRequestSchema, clientProfileSchema } from '@younes/contracts';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import type { AftercareStepRow } from '../../db/types.ts';
import { publicRef } from '../../lib/crypto.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import type { Storage } from '../../lib/storage.ts';
import { record } from '../audit/service.ts';
import { ingestImage } from '../media/service.ts';
import { enqueue } from '../notify/service.ts';

/**
 * What a signed-in client reads and does - always as one client. Every
 * function takes the verified account's client id and every query is
 * filtered by it; a record that belongs to someone else answers exactly
 * like one that doesn't exist (404), so ids reveal nothing.
 */

const iso = (d: Date | string) => new Date(d).toISOString();
const MAX_REFERENCES = 20;
const MAX_HEALING_PHOTOS = 60;

export const mediaUrl = (id: string) => `/api/client/media/${id}`;

/** today's date in the studio's time zone (yyyy-mm-dd) - Detroit's, never the server's */
export async function studioToday(_db: Executor, now: Date) {
  return zonedDate(now, STUDIO_TIME_ZONE);
}

const requestStatus = (status: string) => {
  const s = CLIENT_REQUEST_STATUS[status as InquiryStatus] ?? { label: 'Pending', tone: 'waiting' as const };
  return { status, statusLabel: s.label, tone: s.tone };
};
const projectStatus = (status: string) => ({ status, statusLabel: PROJECT_STATUS_LABEL[status as ProjectStatus] ?? status });

/** one of this client's projects, or a 404 */
async function ownProject(db: Executor, clientId: string, id: string) {
  const p = await db.selectFrom('projects').selectAll().where('id', '=', id).where('client_id', '=', clientId).executeTakeFirst();
  if (!p) throw notFound('That project doesn’t exist.');
  return p;
}
async function ownRequest(db: Executor, clientId: string, id: string) {
  const q = await db.selectFrom('inquiries').selectAll().where('id', '=', id).where('client_id', '=', clientId).where('anonymized_at', 'is', null).executeTakeFirst();
  if (!q) throw notFound('That request doesn’t exist.');
  return q;
}

/** a request's headline: what the idea is, or what's being booked */
function requestTitle(q: { kind: string; summary: Record<string, unknown> }, projectTitle?: string | null) {
  if (q.kind === 'booking') return `Booking request${projectTitle ? ` · ${projectTitle}` : ''}`;
  const concept = typeof q.summary.concept === 'string' ? q.summary.concept : '';
  return concept || 'Consultation';
}

// ---------------- the account ----------------

export async function profile(db: Executor, clientId: string) {
  const c = await db
    .selectFrom('clients as c')
    .innerJoin('client_accounts as a', 'a.client_id', 'c.id')
    .select(['a.name', 'a.email', 'c.phone', 'c.instagram', 'c.preferred_contact'])
    .where('c.id', '=', clientId)
    .executeTakeFirstOrThrow();
  return { name: c.name, email: c.email, phone: c.phone, instagram: c.instagram, preferredContact: c.preferred_contact };
}

export async function updateProfile(db: DB, accountId: string, clientId: string, patch: z.infer<typeof clientProfileSchema>) {
  await db.transaction().execute(async (tx) => {
    if (patch.name) await tx.updateTable('client_accounts').set({ name: patch.name }).where('id', '=', accountId).execute();
    await tx
      .updateTable('clients')
      .set({
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(patch.instagram !== undefined ? { instagram: patch.instagram || null } : {}),
        ...(patch.preferredContact !== undefined ? { preferred_contact: patch.preferredContact } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', clientId)
      .execute();
    // which fields changed, never their values
    await record(tx, { type: 'website' }, 'client.profile_updated', { type: 'client', id: clientId }, { fields: Object.keys(patch) });
  });
}

// ---------------- requests ----------------

export async function listRequests(db: Executor, clientId: string) {
  const rows = await db
    .selectFrom('inquiries as i')
    .leftJoin('projects as p', 'p.id', 'i.project_id')
    .select(['i.id', 'i.public_ref', 'i.kind', 'i.status', 'i.summary', 'i.submitted_at', 'i.updated_at', 'i.project_id', 'p.title as project_title'])
    .where('i.client_id', '=', clientId)
    .where('i.anonymized_at', 'is', null)
    .orderBy('i.submitted_at', 'desc')
    .execute();
  const unread = await unreadByThread(db, clientId);
  return rows.map((q) => ({
    id: q.id,
    ref: q.public_ref,
    kind: q.kind,
    title: requestTitle(q, q.project_title),
    ...requestStatus(q.status),
    submittedAt: iso(q.submitted_at),
    updatedAt: iso(q.updated_at),
    projectId: q.project_id,
    unread: unread.get(q.id) ?? 0,
  }));
}

export async function requestDetail(db: DB, clientId: string, id: string) {
  const q = await ownRequest(db, clientId, id);
  const project = q.project_id ? await db.selectFrom('projects').select(['id', 'title']).where('id', '=', q.project_id).where('client_id', '=', clientId).executeTakeFirst() : undefined;
  // the project this request became, if the studio started one from it
  const grew = await db.selectFrom('projects').select(['id', 'title']).where('inquiry_id', '=', id).where('client_id', '=', clientId).executeTakeFirst();
  const messages = await thread(db, clientId, { inquiryId: id });
  const references = await db.selectFrom('inquiry_references').select(['media_id', 'note']).where('inquiry_id', '=', id).where('kind', '=', 'upload').where('media_id', 'is not', null).orderBy('position').execute();
  return {
    id: q.id,
    ref: q.public_ref,
    references: references.map((r) => ({ url: mediaUrl(r.media_id!), note: r.note })),
    kind: q.kind,
    title: requestTitle(q, project?.title),
    ...requestStatus(q.status),
    submittedAt: iso(q.submitted_at),
    updatedAt: iso(q.updated_at),
    summary: q.summary,
    project: project ?? null,
    becameProject: grew ?? null,
    messages,
  };
}

/**
 * A request from the portal - an inquiry in the studio's pipeline, with
 * the account's own details as its contact. Never an appointment: the
 * studio answers it. The draft's key makes a double send file it once.
 */
export async function submitRequest(db: DB, config: Config, c: { accountId: string; clientId: string }, input: z.infer<typeof clientRequestSchema>, now: Date) {
  const repeat = await db.selectFrom('inquiries').select(['public_ref', 'submitted_at', 'client_id', 'id']).where('idempotency_key', '=', input.idempotencyKey).executeTakeFirst();
  if (repeat) {
    if (repeat.client_id !== c.clientId) throw conflict('This request was already sent. Please start a new one.', 'idempotency_mismatch');
    return { id: repeat.id, ref: repeat.public_ref, receivedAt: iso(repeat.submitted_at), duplicate: true };
  }
  const stored = await db.selectFrom('clients').select(['name', 'email', 'phone', 'instagram']).where('id', '=', c.clientId).executeTakeFirstOrThrow();
  // the account's own (verified) address is how they're reached, whatever the studio's record holds
  const account = await db.selectFrom('client_accounts').select('email').where('id', '=', c.accountId).executeTakeFirstOrThrow();
  const client = { ...stored, email: account.email };
  let project: { id: string; title: string } | undefined;
  if (input.kind === 'booking') project = await ownProject(db, c.clientId, input.projectId);

  const settings = await db.selectFrom('studio_settings').select('notify_email').executeTakeFirstOrThrow();
  const owner = await db.selectFrom('users').select('email').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst();
  const notify = settings.notify_email ?? owner?.email ?? null;

  return db.transaction().execute(async (tx) => {
    const ref = publicRef();
    const summary = input.kind === 'consultation' ? { ...input.summary, references: [] } : { preferredTimes: input.preferredTimes, notes: input.notes, references: [] };
    const entry = input.kind === 'consultation' ? input.entry : { from: 'book' };
    const inquiry = await tx
      .insertInto('inquiries')
      .values({
        public_ref: ref,
        client_id: c.clientId,
        account_id: c.accountId,
        kind: input.kind,
        project_id: project?.id ?? null,
        status: 'submitted',
        entry: JSON.stringify(entry) as never,
        summary: JSON.stringify(summary) as never,
        contact: JSON.stringify({ name: client.name, email: client.email, phone: client.phone ?? undefined, instagram: client.instagram ?? undefined }) as never,
        idempotency_key: input.idempotencyKey,
        consent_at: now,
        privacy_notice_version: input.privacyNoticeVersion,
        submitted_at: now,
      })
      .returning(['id', 'submitted_at'])
      .executeTakeFirstOrThrow();
    // the reference images sent with it: this account's own uploads, not yet sent with anything
    const uploads = input.kind === 'consultation' ? [...new Set(input.referenceUploads ?? [])] : [];
    if (uploads.length) {
      const own = await tx
        .selectFrom('client_uploads')
        .select(['id', 'media_id'])
        .where('id', 'in', uploads)
        .where('account_id', '=', c.accountId)
        .where('attached_at', 'is', null)
        .forUpdate()
        .execute();
      if (own.length !== uploads.length) throw badRequest('One of the images can’t be sent with this request - please upload it again.', { referenceUploads: 'Not available' });
      await tx
        .insertInto('inquiry_references')
        .values(uploads.map((uid, i) => ({ inquiry_id: inquiry.id, kind: 'upload' as const, media_id: own.find((u) => u.id === uid)!.media_id, note: 'Sent with the request', position: i })))
        .execute();
      await tx.updateTable('client_uploads').set({ attached_at: now, inquiry_id: inquiry.id }).where('id', 'in', uploads).execute();
    }
    await record(tx, { type: 'website' }, 'inquiry.submitted', { type: 'inquiry', id: inquiry.id }, { ref, entry: 'portal', kind: input.kind, references: uploads.length });
    const concept = input.kind === 'consultation' ? (input.summary.concept ?? '') : `Booking request for “${project!.title}”`;
    if (notify) await enqueue(tx, { to: notify, template: 'inquiry-received-owner', payload: { name: client.name, ref, concept, link: `${config.PUBLIC_ORIGIN}/studio/inquiries/${inquiry.id}` }, related: { type: 'inquiry', id: inquiry.id } });
    if (client.email) await enqueue(tx, { to: client.email, template: 'inquiry-receipt-client', payload: { name: client.name, ref }, related: { type: 'inquiry', id: inquiry.id } });
    return { id: inquiry.id, ref, receivedAt: iso(inquiry.submitted_at), duplicate: false };
  });
}

// ---------------- messages ----------------

async function unreadByThread(db: Executor, clientId: string) {
  const rows = await db
    .selectFrom('client_messages')
    .select(['inquiry_id', 'project_id'])
    .where('client_id', '=', clientId)
    .where('author', '=', 'studio')
    .where('read_by_client_at', 'is', null)
    .execute();
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r.inquiry_id ?? r.project_id)!;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** a thread, oldest first; the studio's messages in it are now read */
async function thread(db: DB, clientId: string, on: { inquiryId?: string; projectId?: string }) {
  const where = on.inquiryId ? (['inquiry_id', on.inquiryId] as const) : (['project_id', on.projectId!] as const);
  const rows = await db.selectFrom('client_messages').select(['id', 'author', 'body', 'created_at']).where('client_id', '=', clientId).where(where[0], '=', where[1]).orderBy('created_at').execute();
  await db.updateTable('client_messages').set({ read_by_client_at: new Date() }).where('client_id', '=', clientId).where(where[0], '=', where[1]).where('author', '=', 'studio').where('read_by_client_at', 'is', null).execute();
  return rows.map((m) => ({ id: m.id, from: m.author === 'studio' ? ('studio' as const) : ('you' as const), body: m.body, at: iso(m.created_at) }));
}

/** the client writes on a request or a project of theirs; the studio is told there's a message (never what it says) */
export async function postMessage(db: DB, config: Config, clientId: string, on: { inquiryId?: string; projectId?: string }, body: string) {
  if (on.inquiryId) await ownRequest(db, clientId, on.inquiryId);
  else await ownProject(db, clientId, on.projectId!);
  const settings = await db.selectFrom('studio_settings').select('notify_email').executeTakeFirstOrThrow();
  const owner = await db.selectFrom('users').select('email').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst();
  const notify = settings.notify_email ?? owner?.email ?? null;
  const name = (await db.selectFrom('clients').select('name').where('id', '=', clientId).executeTakeFirstOrThrow()).name;
  return db.transaction().execute(async (tx) => {
    const m = await tx
      .insertInto('client_messages')
      .values({ client_id: clientId, inquiry_id: on.inquiryId ?? null, project_id: on.projectId ?? null, author: 'client', body })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();
    await record(tx, { type: 'website' }, 'client.message', on.inquiryId ? { type: 'inquiry', id: on.inquiryId } : { type: 'project', id: on.projectId! });
    const link = on.inquiryId ? `${config.PUBLIC_ORIGIN}/studio/inquiries/all/${on.inquiryId}` : `${config.PUBLIC_ORIGIN}/studio/projects/${on.projectId}`;
    if (notify) await enqueue(tx, { to: notify, template: 'owner-client-message', payload: { name, link }, related: { type: 'client-message', id: m.id } });
    return { id: m.id, at: iso(m.created_at) };
  });
}

// ---------------- projects ----------------

export async function listProjects(db: Executor, clientId: string) {
  const rows = await db.selectFrom('projects').selectAll().where('client_id', '=', clientId).orderBy('updated_at', 'desc').execute();
  const unread = await unreadByThread(db, clientId);
  const covers = await db
    .selectFrom('project_media as pm')
    .innerJoin('projects as p', 'p.id', 'pm.project_id')
    .select(['pm.project_id', 'pm.media_id', 'pm.kind'])
    .where('p.client_id', '=', clientId)
    .orderBy('pm.created_at', 'desc')
    .execute();
  return rows.map((p) => {
    const cover = covers.find((m) => m.project_id === p.id && m.kind === 'design') ?? covers.find((m) => m.project_id === p.id);
    return {
      id: p.id,
      title: p.title,
      concept: p.concept,
      placement: p.placement,
      size: p.size,
      ...projectStatus(p.status),
      updatedAt: iso(p.updated_at),
      cover: cover ? mediaUrl(cover.media_id) : null,
      unread: unread.get(p.id) ?? 0,
    };
  });
}

export async function projectDetail(db: DB, clientId: string, id: string, now: Date) {
  const p = await ownProject(db, clientId, id);
  const [media, appointments, plan, request] = await Promise.all([
    db.selectFrom('project_media').select(['id', 'media_id', 'kind', 'added_by', 'caption', 'created_at']).where('project_id', '=', id).orderBy('created_at').execute(),
    db.selectFrom('appointments').select(['id', 'kind', 'title', 'starts_at', 'ends_at', 'status', 'prep']).where('project_id', '=', id).where('client_id', '=', clientId).orderBy('starts_at').execute(),
    db.selectFrom('aftercare_plans').select(['id', 'started_on']).where('project_id', '=', id).executeTakeFirst(),
    p.inquiry_id ? db.selectFrom('inquiries').select(['id', 'public_ref']).where('id', '=', p.inquiry_id).where('client_id', '=', clientId).executeTakeFirst() : Promise.resolve(undefined),
  ]);
  const messages = await thread(db, clientId, { projectId: id });
  const today = await studioToday(db, now);
  const timezone = STUDIO_TIME_ZONE;
  return {
    id: p.id,
    timezone,
    title: p.title,
    concept: p.concept,
    description: p.description,
    placement: p.placement,
    size: p.size,
    ...projectStatus(p.status),
    createdAt: iso(p.created_at),
    updatedAt: iso(p.updated_at),
    request: request ? { id: request.id, ref: request.public_ref } : null,
    media: media.map((m) => ({ id: m.id, url: mediaUrl(m.media_id), kind: m.kind, addedBy: m.added_by === 'client' ? 'you' : 'studio', caption: m.caption, at: iso(m.created_at) })),
    appointments: appointments.map(appointmentOut),
    aftercare: plan ? { startedOn: plan.started_on, day: daysBetween(plan.started_on, today) } : null,
    messages,
  };
}

export async function addReference(db: DB, storage: Storage, clientId: string, projectId: string, data: Buffer, caption?: string) {
  await ownProject(db, clientId, projectId);
  const n = await db.selectFrom('project_media').select((eb) => eb.fn.countAll<number>().as('n')).where('project_id', '=', projectId).where('added_by', '=', 'client').executeTakeFirstOrThrow();
  if (Number(n.n) >= MAX_REFERENCES) throw badRequest(`A project can hold up to ${MAX_REFERENCES} of your reference images.`, { file: 'Limit reached' });
  const { id: mediaId } = await ingestImage(db, storage, { data, visibility: 'private', folder: 'references', userId: null });
  const row = await db
    .insertInto('project_media')
    .values({ project_id: projectId, media_id: mediaId, kind: 'reference', added_by: 'client', caption: caption?.slice(0, 300) || null })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  await db.updateTable('projects').set({ updated_at: new Date() }).where('id', '=', projectId).execute();
  await record(db, { type: 'website' }, 'project.reference_added', { type: 'project', id: projectId });
  return { id: row.id, url: mediaUrl(mediaId) };
}

// ---------------- appointments ----------------

function appointmentOut(a: { id: string; kind: string; title: string; starts_at: Date | string; ends_at: Date | string; status: string; prep: string | null }) {
  return { id: a.id, kind: a.kind, title: a.title, startsAt: iso(a.starts_at), endsAt: iso(a.ends_at), status: a.status, prep: a.prep };
}

export async function listAppointments(db: Executor, clientId: string, now: Date) {
  const rows = await db
    .selectFrom('appointments as a')
    .leftJoin('projects as p', 'p.id', 'a.project_id')
    .select(['a.id', 'a.kind', 'a.title', 'a.starts_at', 'a.ends_at', 'a.status', 'a.prep', 'a.project_id', 'p.title as project_title'])
    .where('a.client_id', '=', clientId)
    .orderBy('a.starts_at')
    .execute();
  const timezone = STUDIO_TIME_ZONE;
  const list = rows.map((a) => ({ ...appointmentOut(a), projectId: a.project_id, projectTitle: a.project_title }));
  const upcoming = list.filter((a) => new Date(a.endsAt) >= now && (a.status === 'proposed' || a.status === 'confirmed'));
  const history = list.filter((a) => !upcoming.includes(a)).reverse();
  return { timezone, upcoming, history };
}

// ---------------- aftercare ----------------

export async function aftercare(db: Executor, clientId: string, now: Date) {
  const today = await studioToday(db, now);
  const projects = await db.selectFrom('projects').select(['id', 'title', 'status']).where('client_id', '=', clientId).execute();
  const ids = projects.map((p) => p.id);
  if (!ids.length) return { today, plans: [], waiting: [] };
  const [plans, photos] = await Promise.all([
    db.selectFrom('aftercare_plans').selectAll().where('project_id', 'in', ids).execute(),
    db.selectFrom('healing_photos').selectAll().where('project_id', 'in', ids).orderBy('submitted_at', 'desc').execute(),
  ]);
  return {
    today,
    plans: plans.map((pl) => {
      const day = daysBetween(pl.started_on, today);
      const steps = (pl.steps as AftercareStepRow[]).map((s) => ({
        ...s,
        state: day < s.dayFrom ? ('upcoming' as const) : s.dayTo !== null && day > s.dayTo ? ('past' as const) : ('current' as const),
      }));
      return {
        id: pl.id,
        projectId: pl.project_id,
        projectTitle: projects.find((p) => p.id === pl.project_id)!.title,
        title: pl.title,
        intro: pl.intro,
        startedOn: pl.started_on,
        day,
        reminders: pl.reminders,
        steps,
        photos: photos
          .filter((ph) => ph.project_id === pl.project_id)
          .map((ph) => ({ id: ph.id, url: mediaUrl(ph.media_id), note: ph.note, at: iso(ph.submitted_at), day: daysBetween(pl.started_on, zonedDate(ph.submitted_at, STUDIO_TIME_ZONE)), response: ph.response, respondedAt: ph.responded_at ? iso(ph.responded_at) : null })),
      };
    }),
    // healing, but the studio hasn't given aftercare for it yet
    waiting: projects.filter((p) => (p.status === 'healing' || p.status === 'complete') && !plans.some((pl) => pl.project_id === p.id)).map((p) => ({ projectId: p.id, projectTitle: p.title })),
  };
}

export async function addHealingPhoto(db: DB, storage: Storage, config: Config, clientId: string, projectId: string, data: Buffer, note?: string) {
  const p = await ownProject(db, clientId, projectId);
  const plan = await db.selectFrom('aftercare_plans').select('id').where('project_id', '=', projectId).executeTakeFirst();
  if (!plan) throw badRequest('Healing photos open once Younes has given this piece its aftercare.', { file: 'No aftercare yet' });
  const n = await db.selectFrom('healing_photos').select((eb) => eb.fn.countAll<number>().as('n')).where('project_id', '=', projectId).executeTakeFirstOrThrow();
  if (Number(n.n) >= MAX_HEALING_PHOTOS) throw badRequest(`A piece can hold up to ${MAX_HEALING_PHOTOS} healing photos.`, { file: 'Limit reached' });
  const { id: mediaId } = await ingestImage(db, storage, { data, visibility: 'private', folder: 'healing', userId: null });
  const settings = await db.selectFrom('studio_settings').select('notify_email').executeTakeFirstOrThrow();
  const owner = await db.selectFrom('users').select('email').where('role', '=', 'owner').where('disabled_at', 'is', null).executeTakeFirst();
  const notify = settings.notify_email ?? owner?.email ?? null;
  const name = (await db.selectFrom('clients').select('name').where('id', '=', clientId).executeTakeFirstOrThrow()).name;
  return db.transaction().execute(async (tx) => {
    const ph = await tx.insertInto('healing_photos').values({ project_id: projectId, media_id: mediaId, note: note?.slice(0, 1000) || null }).returning(['id']).executeTakeFirstOrThrow();
    await record(tx, { type: 'website' }, 'aftercare.photo_submitted', { type: 'project', id: p.id });
    if (notify) await enqueue(tx, { to: notify, template: 'owner-healing-photo', payload: { name, link: `${config.PUBLIC_ORIGIN}/studio/projects/${p.id}` }, related: { type: 'healing-photo', id: ph.id } });
    return { id: ph.id, url: mediaUrl(mediaId) };
  });
}

/**
 * Reference images for a request not sent yet: the client's own, private
 * (the same ingest as every image - checked by its bytes, re-encoded,
 * metadata dropped). At most 20 waiting at once; unsent ones are cleared
 * after a day (cleanupMedia).
 */
export async function uploadReference(db: DB, storage: Storage, accountId: string, data: Buffer) {
  const waiting = await db.selectFrom('client_uploads').select((eb) => eb.fn.countAll<number>().as('n')).where('account_id', '=', accountId).where('attached_at', 'is', null).executeTakeFirstOrThrow();
  if (Number(waiting.n) >= 20) throw badRequest('That’s a lot of images waiting - send your request, or try again tomorrow.', { file: 'Limit reached' });
  const { id: mediaId } = await ingestImage(db, storage, { data, visibility: 'private', folder: 'references', userId: null });
  const row = await db.insertInto('client_uploads').values({ account_id: accountId, media_id: mediaId }).returning('id').executeTakeFirstOrThrow();
  await record(db, { type: 'website' }, 'client.reference_uploaded', { type: 'client-account', id: accountId });
  return { id: row.id, url: mediaUrl(mediaId) };
}

/**
 * A private image, only if it's this client's: on one of their projects or
 * healing photos, sent with one of their requests, or uploaded by this very
 * account (a reference not sent yet).
 */
export async function ownMedia(db: Executor, clientId: string, mediaId: string, accountId?: string) {
  const viaUpload = accountId ? await db.selectFrom('client_uploads').select('id').where('media_id', '=', mediaId).where('account_id', '=', accountId).executeTakeFirst() : undefined;
  const viaRequest = viaUpload
    ? undefined
    : await db
        .selectFrom('inquiry_references as r')
        .innerJoin('inquiries as i', 'i.id', 'r.inquiry_id')
        .select('r.id')
        .where('r.media_id', '=', mediaId)
        .where('i.client_id', '=', clientId)
        .where('i.anonymized_at', 'is', null)
        .executeTakeFirst();
  if (viaUpload || viaRequest) {
    const a = await db.selectFrom('media_assets').select(['variants']).where('id', '=', mediaId).where('deleted_at', 'is', null).executeTakeFirst();
    if (!a) throw notFound();
    return a;
  }
  return ownProjectMedia(db, clientId, mediaId);
}

async function ownProjectMedia(db: Executor, clientId: string, mediaId: string) {
  const onProject = await db
    .selectFrom('project_media as pm')
    .innerJoin('projects as p', 'p.id', 'pm.project_id')
    .select('pm.id')
    .where('pm.media_id', '=', mediaId)
    .where('p.client_id', '=', clientId)
    .executeTakeFirst();
  const onHealing = onProject
    ? undefined
    : await db
        .selectFrom('healing_photos as h')
        .innerJoin('projects as p', 'p.id', 'h.project_id')
        .select('h.id')
        .where('h.media_id', '=', mediaId)
        .where('p.client_id', '=', clientId)
        .executeTakeFirst();
  if (!onProject && !onHealing) throw notFound();
  const a = await db.selectFrom('media_assets').select(['variants']).where('id', '=', mediaId).where('deleted_at', 'is', null).executeTakeFirst();
  if (!a) throw notFound();
  return a;
}

// ---------------- the overview ----------------

export async function overview(db: DB, clientId: string, account: { name: string }, now: Date) {
  const [requests, projects, appts, care] = await Promise.all([listRequests(db, clientId), listProjects(db, clientId), listAppointments(db, clientId, now), aftercare(db, clientId, now)]);
  const actions: { kind: string; text: string; href: string }[] = [];
  for (const r of requests) if (r.status === 'changes-requested') actions.push({ kind: 'request', text: `Younes needs a little more information about “${r.title}”.`, href: `/portal/requests/${r.id}` });
  for (const a of appts.upcoming) if (a.status === 'proposed') actions.push({ kind: 'appointment', text: `Younes proposed a time for “${a.title}”. Accept or decline it.`, href: `/portal/appointments` });
  for (const r of requests) if (r.unread) actions.push({ kind: 'message', text: `New message from Younes about “${r.title}”.`, href: `/portal/requests/${r.id}` });
  for (const p of projects) if (p.unread) actions.push({ kind: 'message', text: `New message from Younes about “${p.title}”.`, href: `/portal/projects/${p.id}` });
  for (const pl of care.plans) {
    const current = pl.steps.find((s) => s.state === 'current');
    if (current && pl.day >= 0) actions.push({ kind: 'aftercare', text: `Healing day ${pl.day} of “${pl.projectTitle}”: ${current.title}.`, href: '/portal/aftercare' });
  }

  // what changed lately: the studio's messages, answers to healing photos, requests moving on
  const studioMessages = await db
    .selectFrom('client_messages as m')
    .leftJoin('projects as p', 'p.id', 'm.project_id')
    .leftJoin('inquiries as i', 'i.id', 'm.inquiry_id')
    .select(['m.id', 'm.created_at', 'm.project_id', 'm.inquiry_id', 'p.title as project_title', 'i.public_ref'])
    .where('m.client_id', '=', clientId)
    .where('m.author', '=', 'studio')
    .orderBy('m.created_at', 'desc')
    .limit(6)
    .execute();
  const recent = [
    ...studioMessages.map((m) => ({
      at: iso(m.created_at),
      text: m.project_id ? `Younes wrote about “${m.project_title}”` : `Younes replied to your request ${m.public_ref}`,
      href: m.project_id ? `/portal/projects/${m.project_id}` : `/portal/requests/${m.inquiry_id}`,
    })),
    ...requests.filter((r) => r.updatedAt !== r.submittedAt).map((r) => ({ at: r.updatedAt, text: `“${r.title}” is now ${r.statusLabel.toLowerCase()}`, href: `/portal/requests/${r.id}` })),
    ...requests.map((r) => ({ at: r.submittedAt, text: `You sent “${r.title}” (${r.ref})`, href: `/portal/requests/${r.id}` })),
    ...care.plans.flatMap((pl) => pl.photos.filter((ph) => ph.respondedAt).map((ph) => ({ at: ph.respondedAt!, text: `Younes answered your healing photo for “${pl.projectTitle}”`, href: '/portal/aftercare' }))),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const active = projects.find((p) => p.status !== 'complete') ?? projects[0] ?? null;
  return {
    name: account.name,
    project: active,
    projects: projects.length,
    openRequests: requests.filter((r) => r.tone === 'waiting' || r.tone === 'action').length,
    nextAppointment: appts.upcoming[0] ?? null,
    timezone: appts.timezone,
    actions,
    recent,
  };
}
