import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { siteContentSchema, type ContentState, type SiteContentInput } from '@younes/contracts';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { record, type Actor } from '../audit/service.ts';

/**
 * The home page's words and sections: a private draft, and published
 * versions. Publishing validates the draft, writes it as the next version
 * (versions are never edited - history only grows) and makes it the
 * published one; rolling back republishes an older version as a new one.
 *
 * The public bundle (site copy plus the published portfolio, journal,
 * calls and testimonials) is built from the database and cached in memory
 * until something it contains changes. The draft never enters it.
 */

const KEY = 'home';

// ---------------- the public bundle ----------------

let cache: { bundle: PublicBundle; etag: string } | null = null;
let servable: Promise<Set<string>> | null = null;
/** anything in the bundle changed: the next request rebuilds it (and the list of servable files) */
export const invalidatePublic = () => {
  cache = null;
  servable = null;
};

/**
 * The storage keys /media/public may serve: every file of a *published*
 * piece's image, and nothing else - an unpublished piece, or an upload not
 * yet used, isn't served to anyone, even with its exact address (the studio
 * reads those through /api/studio/media/:id, behind the session). Cached
 * with the bundle, and dropped with it whenever a piece changes.
 */
export function servableMediaKeys(db: Executor): Promise<Set<string>> {
  servable ??= db
    .selectFrom('works as w')
    .innerJoin('media_assets as m', 'm.id', 'w.image_id')
    .select(['m.storage_key', 'm.variants'])
    .where('w.published', '=', true)
    .where('m.deleted_at', 'is', null)
    .where('m.visibility', '=', 'public')
    .execute()
    .then((rows) => new Set(rows.flatMap((r) => [r.storage_key, ...r.variants.map((v) => v.key)])))
    .catch((e: unknown) => {
      servable = null;
      throw e;
    });
  return servable;
}

export interface PublicBundle {
  version: number | null;
  generatedAt: string;
  site: SiteContentInput | null;
  works: Record<string, unknown>[];
  journal: Record<string, unknown>[];
  calls: Record<string, unknown>[];
  testimonials: Record<string, unknown>[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const some = <T>(a: T[]) => (a.length ? a : undefined);
export const mediaUrl = (key: string) => `/media/${key}`;

/** the published portfolio, as the site's TattooWork */
export async function publicWorks(db: Executor) {
  const rows = await db
    .selectFrom('works as w')
    .innerJoin('media_assets as m', 'm.id', 'w.image_id')
    .selectAll('w')
    .select(['m.width as img_w', 'm.height as img_h', 'm.variants', 'm.storage_key', 'm.focal'])
    .where('w.published', '=', true)
    .where('m.deleted_at', 'is', null)
    .orderBy('w.sort_order')
    .orderBy('w.number')
    .execute();
  return rows.map((w) => {
    const variants = [...w.variants].filter((v) => v.format === 'webp').sort((a, b) => a.width - b.width);
    const top = variants[variants.length - 1];
    return {
      id: pad(w.number),
      slug: w.slug,
      title: w.title,
      alt: w.alt,
      image: {
        src: mediaUrl(top?.key ?? w.storage_key),
        width: w.img_w ?? top?.width ?? 0,
        height: w.img_h ?? 0,
        variants: variants.map((v) => ({ src: mediaUrl(v.key), width: v.width })),
        ...(w.focal ? { focal: w.focal } : {}),
      },
      description: w.description ?? undefined,
      subject: some(w.subject),
      style: some(w.style),
      composition: some(w.composition),
      linework: some(w.linework),
      mood: some(w.mood),
      placement: w.placement ?? undefined,
      colour: w.colour ?? undefined,
      tags: some(w.tags),
      metadataStatus: w.metadata_status,
    };
  });
}

async function publicJournal(db: Executor) {
  const posts = await db.selectFrom('journal_posts').selectAll().where('published', '=', true).orderBy('date', 'desc').execute();
  const works = await db
    .selectFrom('journal_post_works as pw')
    .innerJoin('works as w', 'w.id', 'pw.work_id')
    .select(['pw.post_id', 'w.number'])
    // only published pieces: an unpublished one isn't named to visitors, even by number
    .where('w.published', '=', true)
    .execute();
  const calls = await db
    .selectFrom('journal_post_calls as pc')
    .innerJoin('canvas_calls as c', 'c.id', 'pc.call_id')
    .select(['pc.post_id', 'c.slug'])
    .where('c.published', '=', true)
    .execute();
  return posts.map((p) => ({
    ...(p.demo ? { demo: true } : {}),
    slug: p.slug,
    kind: p.kind,
    title: p.title,
    date: p.date,
    summary: p.summary,
    body: p.body,
    ...(p.image ? { image: p.image } : {}),
    ...(p.event ? { event: p.event } : {}),
    workIds: some(works.filter((w) => w.post_id === p.id).map((w) => pad(w.number))),
    callSlugs: some(calls.filter((c) => c.post_id === p.id).map((c) => c.slug)),
  }));
}

async function publicCalls(db: Executor) {
  const calls = await db
    .selectFrom('canvas_calls as c')
    .leftJoin('journal_posts as p', 'p.id', 'c.event_post_id')
    .selectAll('c')
    .select('p.slug as event_slug')
    .where('c.published', '=', true)
    .orderBy('c.sort_order')
    .execute();
  const works = await db
    .selectFrom('canvas_call_works as cw')
    .innerJoin('works as w', 'w.id', 'cw.work_id')
    .select(['cw.call_id', 'w.number'])
    .where('w.published', '=', true)
    .execute();
  return calls.map((c) => ({
    ...(c.demo ? { demo: true } : {}),
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    description: c.description,
    status: c.status,
    artwork: c.artwork,
    placement: c.placement ?? undefined,
    scale: c.scale ?? undefined,
    offer: c.offer ?? undefined,
    eligibility: some(c.eligibility),
    deadline: c.deadline ?? undefined,
    eventSlug: c.event_slug ?? undefined,
    workIds: some(works.filter((w) => w.call_id === c.id).map((w) => pad(w.number))),
  }));
}

async function publicTestimonials(db: Executor) {
  const rows = await db
    .selectFrom('testimonials as t')
    .leftJoin('works as w', (j) => j.onRef('w.id', '=', 't.work_id').on('w.published', '=', true))
    .selectAll('t')
    .select('w.number as work_number')
    .where('t.published', '=', true)
    .orderBy('t.sort_order')
    .execute();
  return rows.map((t) => ({
    id: t.ext_id,
    quote: t.quote,
    attribution: t.attribution,
    context: t.context ?? undefined,
    demo: t.demo,
    workId: t.work_number ? pad(t.work_number) : undefined,
    consent: t.consent_date ? { date: t.consent_date, via: t.consent_via } : undefined,
  }));
}

export async function publicBundle(db: Executor): Promise<{ bundle: PublicBundle; etag: string }> {
  if (cache) return cache;
  const doc = await db
    .selectFrom('content_documents as d')
    .leftJoin('content_versions as v', (j) => j.onRef('v.key', '=', 'd.key').onRef('v.version', '=', 'd.published_version'))
    .select(['d.published_version', 'v.data'])
    .where('d.key', '=', KEY)
    .executeTakeFirst();
  const [works, journal, calls, testimonials] = await Promise.all([publicWorks(db), publicJournal(db), publicCalls(db), publicTestimonials(db)]);
  const bundle: PublicBundle = {
    version: doc?.published_version ?? null,
    generatedAt: new Date().toISOString(),
    site: (doc?.data as SiteContentInput | undefined) ?? null,
    works,
    journal,
    calls,
    testimonials,
  };
  const etag = `"${createHash('sha1').update(JSON.stringify({ ...bundle, generatedAt: '' })).digest('base64url')}"`;
  cache = { bundle, etag };
  return cache;
}

// ---------------- the draft and its versions ----------------

/** JSON with object keys sorted: jsonb reorders keys, so two equal documents can stringify differently */
const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export async function state(db: Executor, config: Config): Promise<ContentState> {
  const doc = await db.selectFrom('content_documents').selectAll().where('key', '=', KEY).executeTakeFirst();
  if (!doc) throw notFound('The site’s content hasn’t been imported yet (npm run db:seed).');
  const versions = await db
    .selectFrom('content_versions as v')
    .leftJoin('users as u', 'u.id', 'v.created_by')
    .select(['v.version', 'v.data', 'v.created_at', 'u.name'])
    .where('v.key', '=', KEY)
    .orderBy('v.version', 'desc')
    .execute();
  const current = versions.find((v) => v.version === doc.published_version);
  return {
    key: KEY,
    draft: doc.draft as SiteContentInput,
    draftUpdatedAt: doc.draft_updated_at ? new Date(doc.draft_updated_at).toISOString() : null,
    hasDraft: !current || !same(doc.draft, current.data),
    published: current ? { version: current.version, publishedAt: new Date(current.created_at).toISOString(), data: current.data as SiteContentInput } : null,
    versions: versions.map((v) => ({ version: v.version, publishedAt: new Date(v.created_at).toISOString(), publishedBy: v.name ?? null, current: v.version === doc.published_version })),
    // what "published" reaches: the site this server renders (production), or Vite's dev server reading it
    delivery: config.serveSite || config.NODE_ENV === 'development' ? 'served' : 'not-connected',
  };
}

export async function saveDraft(db: DB, actor: Actor & { type: 'user' }, draft: unknown) {
  const parsed = siteContentSchema.safeParse(draft);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join('.')] ??= i.message;
    throw badRequest('Some fields need another look before the draft can be saved.', fields);
  }
  await db.transaction().execute(async (tx) => {
    await tx.updateTable('content_documents').set({ draft: JSON.stringify(parsed.data) as never, draft_updated_at: new Date(), draft_updated_by: actor.id }).where('key', '=', KEY).execute();
    await record(tx, actor, 'content.draft', { type: 'content', id: KEY });
  });
  return parsed.data;
}

async function nextVersion(tx: Executor) {
  const r = await tx.selectFrom('content_versions').select(sql<number>`coalesce(max(version), 0)::int`.as('v')).where('key', '=', KEY).executeTakeFirstOrThrow();
  return r.v + 1;
}

export async function publish(db: DB, actor: Actor & { type: 'user' }) {
  const version = await db.transaction().execute(async (tx) => {
    // one publish at a time
    const doc = await tx.selectFrom('content_documents').selectAll().where('key', '=', KEY).forUpdate().executeTakeFirstOrThrow();
    const parsed = siteContentSchema.safeParse(doc.draft);
    if (!parsed.success) throw badRequest('The draft isn’t complete enough to publish.');
    const current = doc.published_version
      ? await tx.selectFrom('content_versions').select('data').where('key', '=', KEY).where('version', '=', doc.published_version).executeTakeFirst()
      : undefined;
    if (current && same(current.data, parsed.data)) throw conflict('There’s nothing new to publish - the draft matches the published content.', 'nothing_to_publish');
    const v = await nextVersion(tx);
    await tx.insertInto('content_versions').values({ key: KEY, version: v, data: JSON.stringify(parsed.data) as never, created_by: actor.id }).execute();
    await tx.updateTable('content_documents').set({ published_version: v }).where('key', '=', KEY).execute();
    await record(tx, actor, 'content.published', { type: 'content', id: KEY }, { version: v });
    return v;
  });
  invalidatePublic();
  return version;
}

export async function rollback(db: DB, actor: Actor & { type: 'user' }, to: number) {
  const version = await db.transaction().execute(async (tx) => {
    await tx.selectFrom('content_documents').select('key').where('key', '=', KEY).forUpdate().executeTakeFirstOrThrow();
    const old = await tx.selectFrom('content_versions').select('data').where('key', '=', KEY).where('version', '=', to).executeTakeFirst();
    if (!old) throw notFound(`There’s no version ${to}.`);
    const v = await nextVersion(tx);
    await tx.insertInto('content_versions').values({ key: KEY, version: v, data: JSON.stringify(old.data) as never, created_by: actor.id }).execute();
    // the draft follows: editing continues from what's now live
    await tx.updateTable('content_documents').set({ published_version: v, draft: JSON.stringify(old.data) as never, draft_updated_at: new Date(), draft_updated_by: actor.id }).where('key', '=', KEY).execute();
    await record(tx, actor, 'content.rollback', { type: 'content', id: KEY }, { from: to, version: v });
    return v;
  });
  invalidatePublic();
  return version;
}

/** throw the draft away: it becomes the published content again */
export async function discardDraft(db: DB, actor: Actor & { type: 'user' }) {
  await db.transaction().execute(async (tx) => {
    const doc = await tx.selectFrom('content_documents').select('published_version').where('key', '=', KEY).forUpdate().executeTakeFirstOrThrow();
    if (!doc.published_version) throw conflict('Nothing has been published yet to go back to.');
    const v = await tx.selectFrom('content_versions').select('data').where('key', '=', KEY).where('version', '=', doc.published_version).executeTakeFirstOrThrow();
    await tx.updateTable('content_documents').set({ draft: JSON.stringify(v.data) as never, draft_updated_at: new Date(), draft_updated_by: actor.id }).where('key', '=', KEY).execute();
    await record(tx, actor, 'content.draft_discarded', { type: 'content', id: KEY });
  });
}
