import type { FastifyInstance } from 'fastify';
import { consultationSubmissionSchema } from '@younes/contracts';
import { parse } from '../../lib/errors.ts';
import type { Deps } from '../../lib/http.ts';
import { publicBundle } from '../content/service.ts';
import { submitConsultation } from '../inquiries/service.ts';

/**
 * /api/public - what anyone may call: the published content, and sending a
 * consultation. Nothing here reads a draft or anyone's private details.
 */
export async function publicRoutes(app: FastifyInstance, { db, config, now }: Deps) {
  app.get('/content', async (req, reply) => {
    const { bundle, etag } = await publicBundle(db);
    reply.header('ETag', etag).header('Cache-Control', 'public, max-age=0, must-revalidate');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return bundle;
  });

  app.post('/consultations', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const input = parse(consultationSubmissionSchema, req.body);
    const receipt = await submitConsultation(db, config, input, { ip: req.ip, userAgent: String(req.headers['user-agent'] ?? ''), now: now() });
    return reply.code(receipt.duplicate ? 200 : 201).send(receipt);
  });
}
