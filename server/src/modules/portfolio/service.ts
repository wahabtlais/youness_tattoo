import { sql } from 'kysely';
import type { DB, Executor } from '../../db/index.ts';
import { conflict, notFound } from '../../lib/errors.ts';
import { record, type Actor } from '../audit/service.ts';
import { invalidatePublic } from '../content/service.ts';
import { asset } from '../media/service.ts';

/**
 * The portfolio's records: every piece (published or not) for the studio,
 * with its image and what's known about it. The Portfolio page is their
 * editor; the public bundle shows only published pieces.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** a stored image as the studio fetches it: by id and the width wanted */
const studioMedia = (id: string, width: number) => `/api/studio/media/${id}?w=${width}`;

export async function listWorks(db: Executor) {
  const rows = await db
    .selectFrom('works as w')
    .innerJoin('media_assets as m', 'm.id', 'w.image_id')
    .selectAll('w')
    .select(['m.width as img_w', 'm.height as img_h', 'm.variants'])
    .orderBy('w.sort_order')
    .orderBy('w.number')
    .execute();
  return rows.map((w) => {
    const variants = [...w.variants].sort((a, b) => a.width - b.width);
    return {
      id: w.id,
      number: pad(w.number),
      slug: w.slug,
      title: w.title,
      alt: w.alt,
      description: w.description,
      published: w.published,
      metadataStatus: w.metadata_status,
      traits: { subject: w.subject, style: w.style, composition: w.composition, linework: w.linework, mood: w.mood, placement: w.placement, colour: w.colour, tags: w.tags },
      // through the studio's own image route (signed in only), so an unpublished piece shows here and nowhere else
      image: {
        src: studioMedia(w.image_id, variants[variants.length - 1].width),
        width: w.img_w ?? 0,
        height: w.img_h ?? 0,
        variants: variants.map((v) => ({ src: studioMedia(w.image_id, v.width), width: v.width })),
      },
      updatedAt: new Date(w.updated_at).toISOString(),
    };
  });
}

export async function createWork(db: DB, actor: Actor & { type: 'user' }, input: { mediaId: string; title?: string; alt: string }) {
  const media = await asset(db, input.mediaId);
  if (media.visibility !== 'public') throw conflict('A portfolio piece needs a public image.');
  const id = await db.transaction().execute(async (tx) => {
    await sql`lock table works in share row exclusive mode`.execute(tx);
    const next = await tx.selectFrom('works').select(sql<number>`coalesce(max(number), 0)::int + 1`.as('n')).executeTakeFirstOrThrow();
    const order = await tx.selectFrom('works').select(sql<number>`coalesce(max(sort_order), -1)::int + 1`.as('o')).executeTakeFirstOrThrow();
    const w = await tx
      .insertInto('works')
      .values({
        number: next.n,
        slug: pad(next.n),
        title: input.title?.trim() || 'Tattoo study',
        alt: input.alt,
        image_id: media.id,
        metadata_status: 'demo',
        // a new piece stays private until it's checked and published
        published: false,
        sort_order: order.o,
      })
      .returning(['id', 'number'])
      .executeTakeFirstOrThrow();
    await record(tx, actor, 'work.created', { type: 'work', id: w.id }, { number: pad(w.number) });
    return w.id;
  });
  invalidatePublic();
  return id;
}

export async function updateWork(
  db: DB,
  actor: Actor & { type: 'user' },
  id: string,
  patch: { title?: string; description?: string | null; alt?: string; published?: boolean; metadataStatus?: 'demo' | 'verified' },
) {
  await db.transaction().execute(async (tx) => {
    const w = await tx
      .updateTable('works')
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.alt !== undefined ? { alt: patch.alt } : {}),
        ...(patch.published !== undefined ? { published: patch.published } : {}),
        ...(patch.metadataStatus !== undefined ? { metadata_status: patch.metadataStatus } : {}),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returning('number')
      .executeTakeFirst();
    if (!w) throw notFound('That piece doesn’t exist.');
    await record(tx, actor, 'work.updated', { type: 'work', id }, { number: pad(w.number), fields: Object.keys(patch) });
  });
  invalidatePublic();
}

// ---------------- journal, calls, testimonials: the studio's view and publishing switch ----------------

export async function listJournal(db: Executor) {
  return (await db.selectFrom('journal_posts').select(['id', 'slug', 'title', 'kind', 'date', 'published', 'demo', 'updated_at']).orderBy('date', 'desc').execute()).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    kind: p.kind,
    date: p.date,
    published: p.published,
    demo: p.demo,
  }));
}

export async function listCalls(db: Executor) {
  return (await db.selectFrom('canvas_calls').select(['id', 'slug', 'title', 'status', 'deadline', 'published', 'demo']).orderBy('sort_order').execute()).map((c) => ({ ...c }));
}

export async function listTestimonials(db: Executor) {
  return (
    await db.selectFrom('testimonials').select(['id', 'ext_id', 'quote', 'attribution', 'context', 'consent_date', 'consent_via', 'published', 'demo']).orderBy('sort_order').execute()
  ).map((t) => ({ id: t.id, extId: t.ext_id, quote: t.quote, attribution: t.attribution, context: t.context, consent: t.consent_date ? { date: t.consent_date, via: t.consent_via } : null, published: t.published, demo: t.demo }));
}

export async function setPublished(db: DB, actor: Actor & { type: 'user' }, table: 'journal_posts' | 'canvas_calls' | 'testimonials', id: string, published: boolean) {
  await db.transaction().execute(async (tx) => {
    const r = await tx.updateTable(table).set({ published, updated_at: new Date() }).where('id', '=', id).executeTakeFirst();
    if (Number(r.numUpdatedRows) === 0) throw notFound();
    await record(tx, actor, `${table === 'journal_posts' ? 'journal' : table === 'canvas_calls' ? 'call' : 'testimonial'}.${published ? 'published' : 'unpublished'}`, { type: table, id });
  });
  invalidatePublic();
}
