import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { assertKey } from '../../lib/storage.ts';
import type { Deps } from '../../lib/http.ts';
import { servableMediaKeys } from '../content/service.ts';

const TYPES: Record<string, string> = { '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/**
 * /media/public/… - the published portfolio's images, to anyone. Only the
 * files of a piece that is published right now are served: an unpublished
 * piece's image answers 404 like a missing file, whoever asks and however
 * they learned its address (the studio shows those through
 * /api/studio/media/:id, behind the session). Cached for a day, not
 * forever, so taking a piece off the site takes effect in browsers too.
 * Private files (client references) have no route here at all.
 */
export async function mediaRoutes(app: FastifyInstance, { db, storage }: Deps) {
  app.get<{ Params: { '*': string } }>('/media/public/*', async (req, reply) => {
    const key = `public/${req.params['*']}`;
    try {
      assertKey(key);
    } catch {
      return reply.code(404).send();
    }
    const type = TYPES[path.extname(key).toLowerCase()];
    if (!type || !(await servableMediaKeys(db)).has(key)) return reply.code(404).send();
    const size = await storage.size(key);
    if (size === null) return reply.code(404).send();
    return reply
      .header('Content-Type', type)
      .header('Content-Length', size)
      .header('Cache-Control', 'public, max-age=86400')
      .header('X-Content-Type-Options', 'nosniff')
      .send(storage.stream(key));
  });
}
