import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { AppError } from './lib/errors.ts';
import { requestOrigin, type Deps } from './lib/http.ts';
import { sessionFromToken } from './modules/auth/service.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { publicRoutes } from './modules/public/routes.ts';
import { studioRoutes } from './modules/studio/routes.ts';
import { mediaRoutes } from './modules/media/routes.ts';
import { siteRoutes, siteScriptHashes } from './modules/content/site.ts';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The API as one Fastify app (a modular monolith): shared plugins and
 * guards here, each module's routes in its own folder. Built from its
 * dependencies, so tests construct it against the test database with a
 * fake mailer and AI client.
 */
export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
    requestIdHeader: false,
    genReqId: () => crypto.randomUUID(),
    logger: config.isTest
      ? false
      : {
          level: config.LOG_LEVEL ?? (config.isProd ? 'info' : 'debug'),
          // never log credentials, tokens or client details
          redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]', '*.password', '*.token', '*.email'], censor: '[redacted]' },
          serializers: {
            req: (r) => ({ id: r.id, method: r.method, url: r.url.split('?')[0], ip: r.ip }),
            // an error's type, message, code and stack - not PostgreSQL's `detail`/`where`, which can quote
            // the row's values ("Key (email)=(…) already exists")
            err: (e: Error & { code?: string; constraint?: string }) => ({ type: e.name, message: e.message, code: e.code, constraint: e.constraint, stack: e.stack ?? '' }),
          },
        },
  });

  app.decorateRequest('auth', null);
  // every route, as registered - the authorisation tests sweep this list
  const routeList: { method: string; url: string }[] = [];
  app.decorate('routeList', routeList);
  app.addHook('onRoute', (r) => {
    for (const method of [r.method].flat()) if (method !== 'HEAD') routeList.push({ method, url: r.url });
  });

  await app.register(cookie);
  await app.register(helmet, {
    // the site's own policy - same-origin everything; inline styles because React sets style attributes
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // plus the built page's own inline script(s), by hash (site.ts)
        scriptSrc: ["'self'", ...siteScriptHashes(config)],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
  // per-route limits (route config `rateLimit`); off only in tests that aren't about them
  if (config.RATE_LIMITS) {
    await app.register(rateLimit, {
      global: false,
      // one process: memory is the store; a key per visitor address
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: (_req, ctx) => Object.assign(new Error(`Too many requests. Please try again in ${Math.ceil(ctx.ttl / 1000)} seconds.`), { statusCode: 429 }),
    });
  }
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 10, parts: 12 } });

  // who's asking: the session behind the cookie, if any
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    req.auth = await sessionFromToken(deps.db, req.cookies[config.cookieName]);
  });

  // cross-site request forgery: a state-changing request must come from the site itself,
  // and the studio's own calls carry a header a plain HTML form can't send
  app.addHook('onRequest', async (req, reply) => {
    if (!UNSAFE.has(req.method) || !req.url.startsWith('/api/')) return;
    const origin = requestOrigin(req);
    const studio = req.url.startsWith('/api/studio') || req.url.startsWith('/api/auth');
    if (!origin || !config.allowedOrigins.includes(origin) || (studio && req.headers['x-requested-with'] !== 'younes-studio')) {
      return reply.code(403).type('application/problem+json').send({ status: 403, code: 'csrf', title: 'This request didn’t come from the studio’s own pages.' });
    }
  });

  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.status).type('application/problem+json').send({ status: error.status, code: error.code, title: error.message, fields: error.fields });
    }
    if (error.statusCode === 429) {
      return reply.code(429).type('application/problem+json').send({ status: 429, code: 'rate_limited', title: error.message || 'Too many requests. Please try again shortly.' });
    }
    if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413) {
      return reply.code(413).type('application/problem+json').send({ status: 413, code: 'too_large', title: 'That file is too large.' });
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).type('application/problem+json').send({ status: error.statusCode, code: 'bad_request', title: 'The request couldn’t be read.' });
    }
    req.log.error({ err: error }, 'unhandled error');
    // tests run without a logger: SHOW_ERRORS=1 prints the cause of a 500
    if (config.isTest && process.env.SHOW_ERRORS) process.stderr.write(`\n[500] ${req.method} ${req.url}\n${error.stack ?? JSON.stringify(error)}\n`);
    return reply.code(500).type('application/problem+json').send({ status: 500, code: 'internal', title: 'Something went wrong on our side. Please try again in a moment.' });
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).type('application/problem+json').send({ status: 404, code: 'not_found', title: 'Not found.' });
    return reply.code(404).send('Not found');
  });

  app.get('/api/health', async () => {
    const started = Date.now();
    let database = 'ok';
    try {
      await deps.db.selectNoFrom((eb) => eb.lit(1).as('ok')).execute();
    } catch {
      database = 'unreachable';
    }
    return { status: database === 'ok' ? 'ok' : 'degraded', database, latencyMs: Date.now() - started, ai: deps.ai ? 'configured' : 'off' };
  });

  await app.register((i) => authRoutes(i, deps), { prefix: '/api/auth' });
  await app.register((i) => publicRoutes(i, deps), { prefix: '/api/public' });
  await app.register((i) => studioRoutes(i, deps), { prefix: '/api/studio' });
  await app.register((i) => mediaRoutes(i, deps));
  if (config.serveSite) await app.register((i) => siteRoutes(i, deps));

  return app;
}
