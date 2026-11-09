import type { z } from 'zod';
import { addDays, zonedTimeToInstant } from '@younes/contracts';
import type { aftercareAssignSchema, aftercareGuideSchema, projectCreateSchema, projectUpdateSchema } from '@younes/contracts';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import type { AftercareStepRow } from '../../db/types.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import type { Storage } from '../../lib/storage.ts';
import { record, type Actor } from '../audit/service.ts';
import { ingestImage } from '../media/service.ts';
import { enqueue } from '../notify/service.ts';

/**
 * The studio's side of the client portal: projects, the conversation with
 * a client, aftercare guides (written and approved by Younes - nothing
 * here writes instructions of its own) and the healing photos clients
 * send. All behind the studio's own guard (modules/studio/routes.ts).
 *
 * Emails to a client go only to a verified account's address, say only
 * that something is waiting in the portal (never the message itself), and
 * go through the same outbox as every other email.
 */

type StudioActor = Actor & { type: 'user' };
const iso = (d: Date | string) => new Date(d).toISOString();
export const studioMediaUrl = (id: string) => `/api/studio/media/${id}`;

/** the verified account of a client, if they have one */
async function accountOf(db: Executor, clientId: string) {
  return db.selectFrom('client_accounts').select(['id', 'email', 'email_verified_at', 'created_at']).where('client_id', '=', clientId).where('disabled_at', 'is', null).executeTakeFirst();
}

export async function clientAccount(db: Executor, clientId: string) {
  const a = await accountOf(db, clientId);
  return a ? { email: a.email, verified: !!a.email_verified_at, createdAt: iso(a.created_at) } : null;
}

async function tellClient(db: Executor, config: Config, clientId: string, template: 'client-new-message' | 'client-healing-response', path: string, related: { type: string; id: string }) {
  const a = await accountOf(db, clientId);
  if (!a?.email_verified_at) return;
  await enqueue(db, { to: a.email, template, payload: { link: `${config.PUBLIC_ORIGIN}${path}` }, related });
}

// ---------------- projects ----------------

export async function listProjects(db: Executor, filter: { clientId?: string } = {}) {
  let q = db
    .selectFrom('projects as p')
    .innerJoin('clients as c', 'c.id', 'p.client_id')
    .select(['p.id', 'p.title', 'p.status', 'p.placement', 'p.size', 'p.updated_at', 'p.demo', 'c.id as client_id', 'c.name as client_name'])
    .orderBy('p.updated_at', 'desc');
  if (filter.clientId) q = q.where('p.client_id', '=', filter.clientId);
  const rows = await q.execute();
  const ids = rows.map((r) => r.id);
  const [unread, photos] = ids.length
    ? await Promise.all([
        db.selectFrom('client_messages').select(['project_id']).where('project_id', 'in', ids).where('author', '=', 'client').where('read_by_studio_at', 'is', null).execute(),
        db.selectFrom('healing_photos').select(['project_id']).where('project_id', 'in', ids).where('responded_at', 'is', null).execute(),
      ])
    : [[], []];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    placement: r.placement,
    size: r.size,
    clientId: r.client_id,
    clientName: r.client_name,
    updatedAt: iso(r.updated_at),
    demo: r.demo,
    unreadMessages: unread.filter((m) => m.project_id === r.id).length,
    unansweredPhotos: photos.filter((p) => p.project_id === r.id).length,
  }));
}

export async function projectDetail(db: DB, id: string) {
  const p = await db
    .selectFrom('projects as p')
    .innerJoin('clients as c', 'c.id', 'p.client_id')
    .selectAll('p')
    .select(['c.name as client_name', 'c.email as client_email'])
    .where('p.id', '=', id)
    .executeTakeFirst();
  if (!p) throw notFound('That project doesn’t exist.');
  const [media, messages, appointments, plan, photos, request, account] = await Promise.all([
    db.selectFrom('project_media').selectAll().where('project_id', '=', id).orderBy('created_at').execute(),
    db.selectFrom('client_messages').select(['id', 'author', 'body', 'created_at']).where('project_id', '=', id).orderBy('created_at').execute(),
    db.selectFrom('appointments').select(['id', 'kind', 'title', 'starts_at', 'ends_at', 'status', 'prep']).where('project_id', '=', id).orderBy('starts_at').execute(),
    db.selectFrom('aftercare_plans').selectAll().where('project_id', '=', id).executeTakeFirst(),
    db.selectFrom('healing_photos').selectAll().where('project_id', '=', id).orderBy('submitted_at', 'desc').execute(),
    p.inquiry_id ? db.selectFrom('inquiries').select(['id', 'public_ref']).where('id', '=', p.inquiry_id).executeTakeFirst() : Promise.resolve(undefined),
    clientAccount(db, p.client_id),
  ]);
  // Younes has now seen the client's messages on this project
  await db.updateTable('client_messages').set({ read_by_studio_at: new Date() }).where('project_id', '=', id).where('author', '=', 'client').where('read_by_studio_at', 'is', null).execute();
  return {
    id: p.id,
    title: p.title,
    concept: p.concept,
    description: p.description,
    placement: p.placement,
    size: p.size,
    status: p.status,
    demo: p.demo,
    createdAt: iso(p.created_at),
    updatedAt: iso(p.updated_at),
    client: { id: p.client_id, name: p.client_name, email: p.client_email, account },
    request: request ? { id: request.id, ref: request.public_ref } : null,
    media: media.map((m) => ({ id: m.id, url: studioMediaUrl(m.media_id), kind: m.kind, addedBy: m.added_by, caption: m.caption, at: iso(m.created_at) })),
    messages: messages.map((m) => ({ id: m.id, from: m.author, body: m.body, at: iso(m.created_at) })),
    appointments: appointments.map((a) => ({ id: a.id, kind: a.kind, title: a.title, startsAt: iso(a.starts_at), endsAt: iso(a.ends_at), status: a.status, prep: a.prep })),
    aftercare: plan ? { id: plan.id, guideId: plan.guide_id, title: plan.title, startedOn: plan.started_on, reminders: plan.reminders, steps: plan.steps as AftercareStepRow[], assignedAt: iso(plan.assigned_at) } : null,
    photos: photos.map((ph) => ({ id: ph.id, url: studioMediaUrl(ph.media_id), note: ph.note, at: iso(ph.submitted_at), response: ph.response, respondedAt: ph.responded_at ? iso(ph.responded_at) : null })),
  };
}

const SCALE: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large', 'large-scale': 'Large-scale', 'not-sure': 'Not sure yet' };
const AREA: Record<string, string> = { forearm: 'Forearm', 'upper-arm': 'Upper arm', shoulder: 'Shoulder', chest: 'Chest', back: 'Back', leg: 'Leg', hand: 'Hand', other: 'Elsewhere', 'not-sure': 'Not sure yet' };

/**
 * A project for a client - from one of their requests (its idea, placement
 * and size carried over as a starting point) or on its own.
 */
export async function createProject(db: DB, actor: StudioActor, input: z.infer<typeof projectCreateSchema>) {
  return db.transaction().execute(async (tx) => {
    const client = await tx.selectFrom('clients').select(['id', 'demo']).where('id', '=', input.clientId).where('anonymized_at', 'is', null).executeTakeFirst();
    if (!client) throw notFound('That client doesn’t exist.');
    let from: Record<string, unknown> = {};
    let demo = client.demo;
    if (input.inquiryId) {
      const q = await tx.selectFrom('inquiries').select(['id', 'client_id', 'summary', 'demo']).where('id', '=', input.inquiryId).executeTakeFirst();
      if (!q || q.client_id !== input.clientId) throw badRequest('That request isn’t this client’s.', { inquiryId: 'Not this client’s' });
      if (await tx.selectFrom('projects').select('id').where('inquiry_id', '=', q.id).executeTakeFirst()) throw conflict('A project was already started from this request.', 'project_exists');
      from = q.summary;
      demo = demo || q.demo;
    }
    const s = (k: string) => (typeof from[k] === 'string' && from[k] ? (from[k] as string) : null);
    const placement = input.placement ?? ([s('bodyArea') ? AREA[s('bodyArea')!] : null, s('placement')].filter(Boolean).join(' · ') || null);
    const size = input.size ?? ([s('scale') ? SCALE[s('scale')!] : null, s('size')].filter(Boolean).join(' · ') || null);
    const p = await tx
      .insertInto('projects')
      .values({
        client_id: input.clientId,
        inquiry_id: input.inquiryId ?? null,
        title: input.title,
        concept: input.concept ?? s('concept'),
        description: input.description ?? s('meaning'),
        placement,
        size,
        demo,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await record(tx, actor, 'project.created', { type: 'client', id: input.clientId }, { project: p.id, fromRequest: !!input.inquiryId });
    return p.id;
  });
}

export async function updateProject(db: DB, actor: StudioActor, id: string, patch: z.infer<typeof projectUpdateSchema>) {
  await db.transaction().execute(async (tx) => {
    const r = await tx
      .updateTable('projects')
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.concept !== undefined ? { concept: patch.concept } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.placement !== undefined ? { placement: patch.placement } : {}),
        ...(patch.size !== undefined ? { size: patch.size } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returning('client_id')
      .executeTakeFirst();
    if (!r) throw notFound('That project doesn’t exist.');
    await record(tx, actor, 'project.updated', { type: 'client', id: r.client_id }, { project: id, fields: Object.keys(patch), status: patch.status });
  });
}

export async function addDesign(db: DB, storage: Storage, actor: StudioActor, projectId: string, data: Buffer, caption?: string) {
  const p = await db.selectFrom('projects').select(['id', 'client_id']).where('id', '=', projectId).executeTakeFirst();
  if (!p) throw notFound('That project doesn’t exist.');
  const { id: mediaId } = await ingestImage(db, storage, { data, visibility: 'private', folder: 'designs', userId: actor.id });
  await db.insertInto('project_media').values({ project_id: projectId, media_id: mediaId, kind: 'design', added_by: 'studio', caption: caption?.slice(0, 300) || null }).execute();
  await db.updateTable('projects').set({ updated_at: new Date() }).where('id', '=', projectId).execute();
  await record(db, actor, 'project.design_added', { type: 'client', id: p.client_id }, { project: projectId });
  return { url: studioMediaUrl(mediaId) };
}

// ---------------- messages ----------------

/** a request's conversation with the client (their messages now read) */
export async function inquiryMessages(db: DB, inquiryId: string) {
  const rows = await db.selectFrom('client_messages').select(['id', 'author', 'body', 'created_at']).where('inquiry_id', '=', inquiryId).orderBy('created_at').execute();
  await db.updateTable('client_messages').set({ read_by_studio_at: new Date() }).where('inquiry_id', '=', inquiryId).where('author', '=', 'client').where('read_by_studio_at', 'is', null).execute();
  const q = await db.selectFrom('inquiries').select(['client_id', 'kind', 'project_id']).where('id', '=', inquiryId).executeTakeFirst();
  if (!q) throw notFound('That inquiry doesn’t exist.');
  const project = await db.selectFrom('projects').select(['id', 'title']).where('inquiry_id', '=', inquiryId).executeTakeFirst();
  return {
    kind: q.kind,
    account: await clientAccount(db, q.client_id),
    project: project ?? null,
    bookingFor: q.project_id,
    messages: rows.map((m) => ({ id: m.id, from: m.author, body: m.body, at: iso(m.created_at) })),
  };
}

/** Younes writes to the client - on a request or a project; they're told there's a message waiting */
export async function studioMessage(db: DB, config: Config, actor: StudioActor, on: { inquiryId?: string; projectId?: string }, body: string) {
  return db.transaction().execute(async (tx) => {
    const owner = on.inquiryId
      ? await tx.selectFrom('inquiries').select(['client_id']).where('id', '=', on.inquiryId).where('anonymized_at', 'is', null).executeTakeFirst()
      : await tx.selectFrom('projects').select(['client_id']).where('id', '=', on.projectId!).executeTakeFirst();
    if (!owner) throw notFound();
    const m = await tx
      .insertInto('client_messages')
      .values({ client_id: owner.client_id, inquiry_id: on.inquiryId ?? null, project_id: on.projectId ?? null, author: 'studio', author_user_id: actor.id, body, read_by_studio_at: new Date() })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();
    await record(tx, actor, 'client.message_sent', { type: 'client', id: owner.client_id }, on.inquiryId ? { inquiry: on.inquiryId } : { project: on.projectId });
    await tellClient(tx, config, owner.client_id, 'client-new-message', on.inquiryId ? `/portal/requests/${on.inquiryId}` : `/portal/projects/${on.projectId}`, { type: 'client-message', id: m.id });
    return { id: m.id, at: iso(m.created_at) };
  });
}

/** what's waiting for the studio from clients: unread messages, unanswered healing photos */
export async function portalInbox(db: Executor) {
  const [messages, photos] = await Promise.all([
    db
      .selectFrom('client_messages as m')
      .innerJoin('clients as c', 'c.id', 'm.client_id')
      .leftJoin('projects as p', 'p.id', 'm.project_id')
      .leftJoin('inquiries as i', 'i.id', 'm.inquiry_id')
      .select(['m.id', 'm.created_at', 'm.project_id', 'm.inquiry_id', 'c.name', 'p.title as project_title', 'i.public_ref'])
      .where('m.author', '=', 'client')
      .where('m.read_by_studio_at', 'is', null)
      .orderBy('m.created_at', 'desc')
      .limit(50)
      .execute(),
    db
      .selectFrom('healing_photos as h')
      .innerJoin('projects as p', 'p.id', 'h.project_id')
      .innerJoin('clients as c', 'c.id', 'p.client_id')
      .select(['h.id', 'h.submitted_at', 'p.id as project_id', 'p.title', 'c.name'])
      .where('h.responded_at', 'is', null)
      .orderBy('h.submitted_at')
      .limit(50)
      .execute(),
  ]);
  return {
    messages: messages.map((m) => ({ id: m.id, at: iso(m.created_at), clientName: m.name, projectId: m.project_id, inquiryId: m.inquiry_id, about: m.project_title ?? m.public_ref })),
    photos: photos.map((p) => ({ id: p.id, at: iso(p.submitted_at), clientName: p.name, projectId: p.project_id, projectTitle: p.title })),
  };
}

// ---------------- aftercare guides ----------------

export async function listGuides(db: Executor) {
  const guides = await db.selectFrom('aftercare_guides').selectAll().orderBy('created_at').execute();
  const steps = guides.length ? await db.selectFrom('aftercare_steps').selectAll().where('guide_id', 'in', guides.map((g) => g.id)).orderBy('position').execute() : [];
  const uses = guides.length ? await db.selectFrom('aftercare_plans').select(['guide_id']).where('guide_id', 'in', guides.map((g) => g.id)).execute() : [];
  return guides.map((g) => ({
    id: g.id,
    title: g.title,
    intro: g.intro,
    approved: !!g.approved_at,
    approvedAt: g.approved_at ? iso(g.approved_at) : null,
    updatedAt: iso(g.updated_at),
    usedBy: uses.filter((u) => u.guide_id === g.id).length,
    steps: steps.filter((s) => s.guide_id === g.id).map((s) => ({ dayFrom: s.day_from, dayTo: s.day_to, title: s.title, body: s.body })),
  }));
}

/** saving a guide - new or edited - leaves it unapproved: what clients receive is only ever what Younes approved */
export async function saveGuide(db: DB, actor: StudioActor, id: string | null, input: z.infer<typeof aftercareGuideSchema>) {
  return db.transaction().execute(async (tx) => {
    let guideId = id;
    if (guideId) {
      const r = await tx.updateTable('aftercare_guides').set({ title: input.title, intro: input.intro ?? null, approved_at: null, approved_by: null, updated_at: new Date() }).where('id', '=', guideId).executeTakeFirst();
      if (Number(r.numUpdatedRows) === 0) throw notFound('That guide doesn’t exist.');
      await tx.deleteFrom('aftercare_steps').where('guide_id', '=', guideId).execute();
    } else {
      guideId = (await tx.insertInto('aftercare_guides').values({ title: input.title, intro: input.intro ?? null }).returning('id').executeTakeFirstOrThrow()).id;
    }
    if (input.steps.length) {
      await tx
        .insertInto('aftercare_steps')
        .values(input.steps.map((s, i) => ({ guide_id: guideId!, day_from: s.dayFrom, day_to: s.dayTo ?? null, title: s.title, body: s.body, position: i })))
        .execute();
    }
    await record(tx, actor, id ? 'aftercare.guide_edited' : 'aftercare.guide_created', { type: 'aftercare-guide', id: guideId }, { steps: input.steps.length });
    return guideId;
  });
}

export async function approveGuide(db: DB, actor: StudioActor, id: string) {
  const steps = await db.selectFrom('aftercare_steps').select('id').where('guide_id', '=', id).execute();
  if (!steps.length) throw badRequest('Add at least one stage before approving the guide.');
  const r = await db.updateTable('aftercare_guides').set({ approved_at: new Date(), approved_by: actor.id }).where('id', '=', id).executeTakeFirst();
  if (Number(r.numUpdatedRows) === 0) throw notFound('That guide doesn’t exist.');
  await record(db, actor, 'aftercare.guide_approved', { type: 'aftercare-guide', id });
}

export async function deleteGuide(db: DB, actor: StudioActor, id: string) {
  // plans already given keep their own copy of the text
  const r = await db.deleteFrom('aftercare_guides').where('id', '=', id).executeTakeFirst();
  if (Number(r.numDeletedRows) === 0) throw notFound('That guide doesn’t exist.');
  await record(db, actor, 'aftercare.guide_deleted', { type: 'aftercare-guide', id });
}

/** reminders go at 10:00 Detroit time on each stage's first day (EST or EDT, whichever is in force that day) */
const reminderAt = (startedOn: string, day: number) => zonedTimeToInstant(addDays(startedOn, day), '10:00');

/**
 * Give a finished piece its aftercare: a copy of an approved guide as it
 * reads now, from the session's day. Reminders (if on) are queued for each
 * stage's first day that's still ahead - only to a verified account. Giving
 * it again replaces the copy and its reminders.
 */
export async function assignAftercare(db: DB, config: Config, actor: StudioActor, projectId: string, input: z.infer<typeof aftercareAssignSchema>, now: Date) {
  return db.transaction().execute(async (tx) => {
    const p = await tx.selectFrom('projects').select(['id', 'client_id', 'status', 'title']).where('id', '=', projectId).executeTakeFirst();
    if (!p) throw notFound('That project doesn’t exist.');
    const g = await tx.selectFrom('aftercare_guides').selectAll().where('id', '=', input.guideId).executeTakeFirst();
    if (!g) throw notFound('That guide doesn’t exist.');
    if (!g.approved_at) throw conflict('Approve this guide before giving it to a client.', 'guide_not_approved');
    const steps = (await tx.selectFrom('aftercare_steps').selectAll().where('guide_id', '=', g.id).orderBy('position').execute()).map((s) => ({ dayFrom: s.day_from, dayTo: s.day_to, title: s.title, body: s.body }));

    const existing = await tx.selectFrom('aftercare_plans').select('id').where('project_id', '=', projectId).executeTakeFirst();
    const values = { guide_id: g.id, title: g.title, intro: g.intro, steps: JSON.stringify(steps) as never, started_on: input.startedOn, reminders: input.reminders, assigned_by: actor.id };
    const planId = existing
      ? (await tx.updateTable('aftercare_plans').set({ ...values, assigned_at: now }).where('id', '=', existing.id).returning('id').executeTakeFirstOrThrow()).id
      : (await tx.insertInto('aftercare_plans').values({ project_id: projectId, ...values }).returning('id').executeTakeFirstOrThrow()).id;
    // reminders from an earlier copy that haven't gone yet are withdrawn
    await tx.deleteFrom('email_outbox').where('related_type', '=', 'aftercare-plan').where('related_id', '=', planId).where('status', '=', 'pending').execute();

    let queued = 0;
    const a = await accountOf(tx, p.client_id);
    if (input.reminders && a?.email_verified_at) {
      for (const s of steps) {
        const at = reminderAt(input.startedOn, s.dayFrom);
        if (at <= now) continue;
        await enqueue(tx, { to: a.email, template: 'aftercare-reminder', payload: { stage: s.title, project: p.title, link: `${config.PUBLIC_ORIGIN}/portal/aftercare` }, related: { type: 'aftercare-plan', id: planId }, sendAfter: at });
        queued++;
      }
    }
    if (p.status !== 'complete') await tx.updateTable('projects').set({ status: 'healing', updated_at: new Date() }).where('id', '=', projectId).execute();
    await record(tx, actor, 'aftercare.assigned', { type: 'client', id: p.client_id }, { project: projectId, guide: g.id, reminders: queued });
    return { planId, reminders: queued };
  });
}

export async function respondToPhoto(db: DB, config: Config, actor: StudioActor, photoId: string, response: string) {
  return db.transaction().execute(async (tx) => {
    const ph = await tx
      .updateTable('healing_photos')
      .set({ response, responded_at: new Date(), responded_by: actor.id })
      .where('id', '=', photoId)
      .returning(['project_id'])
      .executeTakeFirst();
    if (!ph) throw notFound('That photo doesn’t exist.');
    const p = await tx.selectFrom('projects').select(['client_id']).where('id', '=', ph.project_id).executeTakeFirstOrThrow();
    await record(tx, actor, 'aftercare.photo_answered', { type: 'client', id: p.client_id }, { project: ph.project_id });
    await tellClient(tx, config, p.client_id, 'client-healing-response', '/portal/aftercare', { type: 'healing-photo', id: photoId });
  });
}
