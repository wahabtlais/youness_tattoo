import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  availabilitySchema,
  clientUpdateSchema,
  followUpCreateSchema,
  followUpUpdateSchema,
  noteSchema,
  proposalDecisionSchema,
  publishToggleSchema,
  settingsUpdateSchema,
  statusChangeSchema,
  workUpdateSchema,
} from '@younes/contracts';
import { badRequest, notFound, parse } from '../../lib/errors.ts';
import { requireUser, type Deps, type Permission } from '../../lib/http.ts';
import * as ai from '../ai/service.ts';
import { recent } from '../audit/service.ts';
import * as calendar from '../calendar/service.ts';
import * as clients from '../clients/service.ts';
import * as content from '../content/service.ts';
import * as inquiries from '../inquiries/service.ts';
import * as media from '../media/service.ts';
import * as outbox from '../notify/service.ts';
import * as portfolio from '../portfolio/service.ts';

const idParam = z.object({ id: z.uuid() });
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * /api/studio - everything private. The guard is the plugin's own hook, so
 * there's no route here that forgets it: signed in, past the second step,
 * and allowed (read for GET, write otherwise; publishing and settings name
 * their own permission). The tests sweep every route anonymously.
 */
export async function studioRoutes(app: FastifyInstance, deps: Deps) {
  const { db, config, storage } = deps;

  app.addHook('preHandler', async (req) => {
    const special = (req.routeOptions.config as { permission?: Permission } | undefined)?.permission;
    requireUser(req, special ?? (WRITE.has(req.method) ? 'studio:write' : 'studio:read'));
  });

  const actor = (req: FastifyRequest) => ({ type: 'user' as const, id: req.auth!.user.id });
  const id = (req: FastifyRequest) => parse(idParam, req.params).id;

  // ---------------- overview and history ----------------
  app.get('/overview', async () => clients.overview(db, deps.now()));
  app.get('/activity', async (req) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    return recent(db, limit);
  });

  // ---------------- inquiries ----------------
  app.get('/inquiries/:id', async (req) => inquiries.inquiryDetail(db, id(req)));
  app.patch('/inquiries/:id/status', async (req) => {
    const body = parse(statusChangeSchema, req.body);
    return inquiries.setStatus(db, actor(req), id(req), body.status, body.note);
  });
  app.post('/inquiries/:id/notes', async (req, reply) => {
    const { body } = parse(noteSchema, req.body);
    return reply.code(201).send(await inquiries.addNote(db, actor(req), { inquiryId: id(req) }, body));
  });

  // ---------------- clients and follow-ups ----------------
  app.get('/clients/:id', async (req) => clients.clientDetail(db, id(req)));
  app.patch('/clients/:id', async (req) => {
    await clients.updateClient(db, actor(req), id(req), parse(clientUpdateSchema, req.body));
    return { ok: true };
  });
  app.post('/clients/:id/notes', async (req, reply) => {
    const { body } = parse(noteSchema, req.body);
    return reply.code(201).send(await inquiries.addNote(db, actor(req), { clientId: id(req) }, body));
  });
  app.post('/follow-ups', async (req, reply) => reply.code(201).send({ id: await clients.createFollowUp(db, actor(req), parse(followUpCreateSchema, req.body)) }));
  app.patch('/follow-ups/:id', async (req) => {
    await clients.setFollowUpDone(db, actor(req), id(req), parse(followUpUpdateSchema, req.body).done);
    return { ok: true };
  });

  // ---------------- calendar ----------------
  app.get('/appointments', async (req) => {
    const q = parse(z.object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) }), req.query);
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (to <= from || to.getTime() - from.getTime() > 400 * 86_400_000) throw badRequest('Choose a range of up to about a year.');
    return calendar.list(db, from, to);
  });
  app.post('/appointments', async (req, reply) => reply.code(201).send({ id: await calendar.create(db, actor(req), parse(appointmentCreateSchema, req.body)) }));
  app.patch('/appointments/:id', async (req) => {
    await calendar.update(db, actor(req), id(req), parse(appointmentUpdateSchema, req.body));
    return { ok: true };
  });
  app.get('/availability', async () => ({ windows: await calendar.availability(db) }));
  app.put('/availability', async (req) => {
    await calendar.setAvailability(db, actor(req), parse(availabilitySchema, req.body).windows);
    return { ok: true };
  });

  // ---------------- website content ----------------
  app.get('/content/home', async () => content.state(db, config));
  app.put('/content/home/draft', async (req) => ({ draft: await content.saveDraft(db, actor(req), (req.body as { draft?: unknown } | null)?.draft) }));
  app.delete('/content/home/draft', async (req) => {
    await content.discardDraft(db, actor(req));
    return { ok: true };
  });
  app.post('/content/home/publish', { config: { permission: 'content:publish' } }, async (req) => ({ version: await content.publish(db, actor(req)) }));
  app.post('/content/home/rollback', { config: { permission: 'content:publish' } }, async (req) => {
    const { version } = parse(z.object({ version: z.number().int().positive() }), req.body);
    return { version: await content.rollback(db, actor(req), version) };
  });
  /** the draft, for the site's preview - private like every studio route */
  app.get('/content/home/preview', async (_req, reply) => {
    const s = await content.state(db, config);
    reply.header('Cache-Control', 'private, no-store');
    return { site: s.draft };
  });

  // ---------------- portfolio and media ----------------
  app.get('/works', async () => portfolio.listWorks(db));
  app.post('/works', async (req, reply) => {
    const body = parse(z.object({ mediaId: z.uuid(), title: z.string().trim().max(120).optional(), alt: z.string().trim().min(1).max(300) }), req.body);
    return reply.code(201).send({ id: await portfolio.createWork(db, actor(req), body) });
  });
  app.patch('/works/:id', async (req) => {
    await portfolio.updateWork(db, actor(req), id(req), parse(workUpdateSchema, req.body));
    return { ok: true };
  });
  app.post('/media', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const q = parse(z.object({ visibility: z.enum(['public', 'private']).default('public') }), req.query);
    const file = await req.file();
    if (!file) throw badRequest('Choose an image to upload.', { file: 'Missing' });
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch {
      throw badRequest('That file is too large (at most 20 MB).', { file: 'Too large' });
    }
    const alt = typeof (file.fields.alt as { value?: unknown } | undefined)?.value === 'string' ? String((file.fields.alt as { value: string }).value).slice(0, 300) : undefined;
    const r = await media.ingestImage(db, storage, { data, visibility: q.visibility, folder: q.visibility === 'public' ? 'works' : 'references', alt, userId: req.auth!.user.id });
    return reply.code(r.reused ? 200 : 201).send(r);
  });
  /** any stored image - private ones only here, behind the session */
  app.get('/media/:id', async (req, reply) => {
    const a = await media.asset(db, id(req));
    const { w } = parse(z.object({ w: z.coerce.number().int().min(1).max(4000).optional() }), req.query);
    const v = media.pickVariant(a.variants, w);
    if (!v || (await storage.size(v.key)) === null) throw notFound();
    return reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', 'inline; filename="image.webp"')
      .send(storage.stream(v.key));
  });

  // ---------------- journal, canvas calls, testimonials ----------------
  app.get('/journal', async () => portfolio.listJournal(db));
  app.get('/calls', async () => portfolio.listCalls(db));
  app.get('/testimonials', async () => portfolio.listTestimonials(db));
  for (const [path, table] of [
    ['journal', 'journal_posts'],
    ['calls', 'canvas_calls'],
    ['testimonials', 'testimonials'],
  ] as const) {
    app.patch(`/${path}/:id`, { config: { permission: 'content:publish' } }, async (req) => {
      await portfolio.setPublished(db, actor(req), table, id(req), parse(publishToggleSchema, req.body).published);
      return { ok: true };
    });
  }

  // ---------------- settings and email ----------------
  app.get('/settings', async () => clients.settings(db));
  app.patch('/settings', { config: { permission: 'settings:write' } }, async (req) => {
    await clients.updateSettings(db, actor(req), parse(settingsUpdateSchema, req.body));
    return clients.settings(db);
  });
  app.get('/outbox', async () => outbox.list(db));
  app.post('/outbox/:id/retry', async (req) => {
    if (!(await outbox.retry(db, id(req)))) throw notFound('Only a failed message can be retried.');
    return { ok: true };
  });

  // ---------------- assistant ----------------
  app.get('/ai/status', async () => ai.status(db, config, deps.ai));
  app.post('/ai/inquiries/:id/:task', { config: { permission: 'ai:use', rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req, reply) => {
    const { id: inquiryId, task } = parse(z.object({ id: z.uuid(), task: z.enum(['summary', 'reply-draft']) }), req.params);
    return reply.code(201).send(await ai.runTask(db, config, deps.ai, req.auth!.user.id, task === 'summary' ? 'inquiry-summary' : 'reply-draft', inquiryId));
  });
  app.post('/ai/proposals/:id/decision', { config: { permission: 'ai:use' } }, async (req) => ai.decide(db, req.auth!.user.id, id(req), parse(proposalDecisionSchema, req.body).decision));
}
