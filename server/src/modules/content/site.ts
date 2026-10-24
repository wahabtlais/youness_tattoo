import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { injectContent } from '@younes/contracts';
import type { Deps } from '../../lib/http.ts';
import { publicBundle } from './service.ts';

/**
 * The CSP sources for the page's own inline scripts (index.html sets the
 * studio's theme before the first paint): each one's SHA-256, so exactly
 * those run and nothing else inline does - no 'unsafe-inline'. Data blocks
 * (type="application/json", the published content) aren't executed and
 * need none.
 */
export function inlineScriptHashes(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? '';
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs)) continue;
    // browsers hash the script as parsed: line breaks are normalised to LF first (a Windows checkout has CRLF)
    const text = m[2].replace(/\r\n?/g, '\n');
    out.push(`'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`);
  }
  return out;
}

/** the built page's inline-script hashes, when this server serves it */
export function siteScriptHashes(config: { serveSite: boolean; SITE_DIST_DIR: string }): string[] {
  const indexFile = path.join(path.resolve(config.SITE_DIST_DIR), 'index.html');
  return config.serveSite && existsSync(indexFile) ? inlineScriptHashes(readFileSync(indexFile, 'utf8')) : [];
}

/**
 * Serving the built site (production, or SERVE_SITE=true): the files in
 * dist/ as they are - hashed assets cached for a year - and, for every
 * page address, index.html with the published content written into it,
 * so the site has its words and work before the first paint. The page
 * itself is never cached, so a publish shows on the next load.
 */
export async function siteRoutes(app: FastifyInstance, { db, config }: Deps) {
  const root = path.resolve(config.SITE_DIST_DIR);
  const indexFile = path.join(root, 'index.html');
  if (!existsSync(indexFile)) {
    app.log.warn(`SERVE_SITE is on but ${indexFile} doesn't exist - run npm run build first`);
    return;
  }
  const template = readFileSync(indexFile, 'utf8');

  await app.register(fastifyStatic, {
    root,
    index: false,
    wildcard: false,
    setHeaders(reply, file) {
      const assets = file.includes(`${path.sep}assets${path.sep}`);
      reply.header('Cache-Control', assets ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    },
  });

  app.get('/*', async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/media/')) return reply.callNotFound();
    const { bundle } = await publicBundle(db);
    return reply.header('Content-Type', 'text/html; charset=utf-8').header('Cache-Control', 'no-cache').send(injectContent(template, bundle));
  });
}
