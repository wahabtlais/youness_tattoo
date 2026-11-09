import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  clientForgotSchema,
  clientLoginSchema,
  clientPasswordChangeSchema,
  clientProfileSchema,
  clientRegisterSchema,
  clientRequestSchema,
  clientResetSchema,
  clientTokenSchema,
  deletionRequestSchema,
  messageSchema,
  type ClientSessionState,
} from '@younes/contracts';
import { badRequest, notFound, parse } from '../../lib/errors.ts';
import type { Deps } from '../../lib/http.ts';
import { pickVariant } from '../media/service.ts';
import * as account from './account.ts';
import * as auth from './auth.ts';
import * as portal from './portal.ts';
import { respondToProposal } from '../calendar/service.ts';

const idParam = z.object({ id: z.uuid() });

/**
 * /api/client - a client's own account and records. The guard is the
 * plugin's hook, as in the studio: every route except the handful that
 * must work signed-out (listed in OPEN) needs a verified client, and every
 * read or write below it is scoped to that client (modules/client/portal).
 * This prefix never reads the studio's session, and the studio's never
 * reads this one.
 */
const OPEN = new Set(['/session', '/register', '/verify', '/verify/resend', '/login', '/logout', '/password/forgot', '/password/reset']);

export async function clientRoutes(app: FastifyInstance, deps: Deps) {
  const { db, config, storage } = deps;
  const strict = { rateLimit: { max: 10, timeWindow: '1 minute' } };
  const mailing = { rateLimit: { max: 5, timeWindow: '15 minutes' } };

  app.addHook('preHandler', async (req) => {
    const path = (req.routeOptions.url ?? '').replace(/^\/api\/client/, '');
    if (OPEN.has(path)) return;
    auth.requireClient(req);
  });

  const me = (req: FastifyRequest) => auth.requireClient(req);
  const id = (req: FastifyRequest) => parse(idParam, req.params).id;

  /** one uploaded image and its text field (caption / note) */
  async function upload(req: FastifyRequest, field: string) {
    const file = await req.file();
    if (!file) throw badRequest('Choose an image to upload.', { file: 'Missing' });
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch {
      throw badRequest('That file is too large (at most 20 MB).', { file: 'Too large' });
    }
    const raw = (file.fields[field] as { value?: unknown } | undefined)?.value;
    return { data, text: typeof raw === 'string' ? raw.trim() : undefined };
  }

  // ---------------- the account ----------------

  app.get('/session', async (req): Promise<ClientSessionState> => {
    const c = req.client;
    return { account: c ? { id: c.account.id, name: c.account.name, email: c.account.email, verified: c.account.verified } : null };
  });

  /** always the same answer: whether the address already has an account is never revealed */
  app.post('/register', { config: mailing }, async (req, reply) => {
    const body = parse(clientRegisterSchema, req.body);
    await auth.register(db, config, body);
    return reply.code(202).send({ ok: true });
  });

  app.post('/verify', { config: strict }, async (req, reply) => {
    const { token } = parse(clientTokenSchema, req.body);
    if (req.client) await auth.revokeClientSession(db, req.client.sessionId);
    const session = await auth.verifyEmail(db, token, String(req.headers['user-agent'] ?? ''));
    auth.setClientCookie(reply, session);
    return { ok: true };
  });

  app.post('/verify/resend', { config: mailing }, async (req, reply) => {
    const { email } = parse(clientForgotSchema, req.body);
    await auth.resendVerification(db, config, email);
    return reply.code(202).send({ ok: true });
  });

  app.post('/login', { config: strict }, async (req, reply) => {
    const body = parse(clientLoginSchema, req.body);
    if (req.client) await auth.revokeClientSession(db, req.client.sessionId);
    const session = await auth.login(db, body, { ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
    auth.setClientCookie(reply, session);
    return { ok: true };
  });

  app.post('/logout', async (req, reply) => {
    if (req.client) await auth.revokeClientSession(db, req.client.sessionId);
    auth.clearClientCookie(reply);
    return { ok: true };
  });

  app.post('/password/forgot', { config: mailing }, async (req, reply) => {
    const { email } = parse(clientForgotSchema, req.body);
    await auth.requestReset(db, config, email);
    return reply.code(202).send({ ok: true });
  });

  app.post('/password/reset', { config: strict }, async (req, reply) => {
    const { token, password } = parse(clientResetSchema, req.body);
    await auth.resetPassword(db, token, password);
    auth.clearClientCookie(reply);
    return { ok: true };
  });

  app.post('/password/change', { config: strict }, async (req) => {
    const c = me(req);
    const { current, password } = parse(clientPasswordChangeSchema, req.body);
    await auth.changePassword(db, c, current, password);
    return { ok: true };
  });

  app.get('/profile', async (req) => {
    const c = me(req);
    return portal.profile(db, c.account.clientId);
  });
  app.patch('/profile', async (req) => {
    const c = me(req);
    await portal.updateProfile(db, c.account.id, c.account.clientId, parse(clientProfileSchema, req.body));
    return portal.profile(db, c.account.clientId);
  });

  // ---------------- their data ----------------

  /** what the studio holds about them, to review */
  app.get('/account/data', async (req) => {
    const c = me(req);
    return account.dataSummary(db, { id: c.account.id, clientId: c.account.clientId });
  });
  /** a copy of it, as a JSON file */
  app.get('/account/export', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const data = await account.exportData(db, { id: c.account.id, clientId: c.account.clientId });
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="younes-tattoo-my-data.json"')
      .header('Cache-Control', 'private, no-store')
      .send(JSON.stringify(data, null, 2));
  });
  /** asking for the account to be closed - Younes reviews it; nothing is deleted automatically */
  app.post('/account/deletion', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const { reason } = parse(deletionRequestSchema, req.body);
    return reply.code(201).send(await account.requestDeletion(db, config, { id: c.account.id, clientId: c.account.clientId, name: c.account.name }, reason));
  });
  app.delete('/account/deletion', async (req) => {
    const c = me(req);
    await account.withdrawDeletion(db, { id: c.account.id, clientId: c.account.clientId });
    return { ok: true };
  });

  // ---------------- the portal ----------------

  app.get('/overview', async (req) => {
    const c = me(req);
    return portal.overview(db, c.account.clientId, c.account, deps.now());
  });

  app.get('/requests', async (req) => portal.listRequests(db, me(req).account.clientId));
  /** a reference image for a request not sent yet (it joins the request when it's sent) */
  app.post('/uploads', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const { data } = await upload(req, 'caption');
    return reply.code(201).send(await portal.uploadReference(db, storage, c.account.id, data));
  });
  app.get('/requests/:id', async (req) => portal.requestDetail(db, me(req).account.clientId, id(req)));
  app.post('/requests', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const r = await portal.submitRequest(db, config, { accountId: c.account.id, clientId: c.account.clientId }, parse(clientRequestSchema, req.body), deps.now());
    return reply.code(r.duplicate ? 200 : 201).send(r);
  });
  app.post('/requests/:id/messages', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { body } = parse(messageSchema, req.body);
    return reply.code(201).send(await portal.postMessage(db, config, me(req).account.clientId, { inquiryId: id(req) }, body));
  });

  app.get('/projects', async (req) => portal.listProjects(db, me(req).account.clientId));
  app.get('/projects/:id', async (req) => portal.projectDetail(db, me(req).account.clientId, id(req), deps.now()));
  app.post('/projects/:id/messages', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { body } = parse(messageSchema, req.body);
    return reply.code(201).send(await portal.postMessage(db, config, me(req).account.clientId, { projectId: id(req) }, body));
  });
  app.post('/projects/:id/references', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const projectId = id(req);
    const { data, text } = await upload(req, 'caption');
    return reply.code(201).send(await portal.addReference(db, storage, c.account.clientId, projectId, data, text));
  });

  app.get('/appointments', async (req) => portal.listAppointments(db, me(req).account.clientId, deps.now()));
  /** answering a time Younes proposed: confirmed, or declined, only once the server has done it */
  for (const [path, accept] of [['accept', true], ['decline', false]] as const) {
    app.post(`/appointments/:id/${path}`, { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) =>
      respondToProposal(db, config, me(req).account.clientId, id(req), accept, deps.now()),
    );
  }

  app.get('/aftercare', async (req) => portal.aftercare(db, me(req).account.clientId, deps.now()));
  app.post('/projects/:id/healing-photos', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const c = me(req);
    const projectId = id(req);
    const { data, text } = await upload(req, 'note');
    return reply.code(201).send(await portal.addHealingPhoto(db, storage, config, c.account.clientId, projectId, data, text));
  });

  /** a private image - only one on this client's own projects or healing photos */
  app.get('/media/:id', async (req, reply) => {
    const c = me(req);
    const a = await portal.ownMedia(db, c.account.clientId, id(req), c.account.id);
    const { w } = parse(z.object({ w: z.coerce.number().int().min(1).max(4000).optional() }), req.query);
    const v = pickVariant(a.variants, w);
    if (!v || (await storage.size(v.key)) === null) throw notFound();
    return reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', 'inline; filename="image.webp"')
      .header('X-Content-Type-Options', 'nosniff')
      .send(storage.stream(v.key));
  });
}
