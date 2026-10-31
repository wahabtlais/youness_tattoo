import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'kysely';
import { REPO_ROOT } from '../../config.ts';
import type { Storage } from '../../lib/storage.ts';
import type { DB } from '../index.ts';
import type { ImageVariantRow } from '../types.ts';

/**
 * Seeds - every one safe to run again (it adds what's missing and never
 * overwrites what the studio has since edited).
 *
 * `seedContent` imports what the public site shows today from the site's
 * own files (src/data/*): the real artwork (copied into storage, the
 * originals left untouched), the home page's words, and the journal,
 * canvas calls and testimonials - which are fictional demo records today
 * and stay marked `demo` in the database, exactly as on the site.
 *
 * `seedDemo` (development only) adds the dashboard's fictional sample
 * clients, inquiries, appointments and follow-ups, every row `demo = true`
 * and labelled "Sample" wherever it's shown. They have no contact details:
 * nothing about them can pass for a real client.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export async function seedContent(db: DB, storage: Storage) {
  // the site's own data modules (asset imports resolved by register-assets.mjs)
  const { WORK } = await import('../../../../src/data/work.ts');
  const { SITE_CONTENT } = await import('../../../../src/data/siteContent.ts');
  const { JOURNAL } = await import('../../../../src/data/journal.ts');
  const { CANVAS_CALLS } = await import('../../../../src/data/canvasCalls.ts');
  const { CLIENT_EXPERIENCES } = await import('../../../../src/data/clientExperiences.ts');

  const log: string[] = [];

  // ---- the work: real photographs, copied into public storage ----
  const workIds = new Map<string, string>();
  for (const [i, w] of WORK.entries()) {
    const number = Number(w.id);
    const existing = await db.selectFrom('works').select('id').where('number', '=', number).executeTakeFirst();
    if (existing) {
      workIds.set(w.id, existing.id);
      continue;
    }
    const variants: ImageVariantRow[] = [];
    let largest: Buffer | null = null;
    for (const v of w.image.variants) {
      const bytes = await readFile(path.join(REPO_ROOT, 'public', v.src));
      const key = `public/works/${pad(number)}-${v.width}.webp`;
      if ((await storage.size(key)) === null) await storage.put(key, bytes);
      variants.push({ key, width: v.width, format: 'webp', bytes: bytes.length });
      if (!largest || bytes.length > largest.length) largest = bytes;
    }
    const top = variants.reduce((a, b) => (b.width > a.width ? b : a));
    const media = await db
      .insertInto('media_assets')
      .values({
        visibility: 'public',
        kind: 'image',
        mime: 'image/webp',
        bytes: top.bytes,
        width: w.image.width,
        height: w.image.height,
        sha256: createHash('sha256').update(largest!).digest('hex'),
        storage_key: top.key,
        variants: JSON.stringify(variants) as never,
        alt: w.alt,
        origin: 'seed:public/work',
      })
      .onConflict((oc) => oc.column('storage_key').doUpdateSet({ storage_key: (eb) => eb.ref('excluded.storage_key') }))
      .returning('id')
      .executeTakeFirstOrThrow();
    const row = await db
      .insertInto('works')
      .values({
        number,
        slug: w.slug,
        title: w.title,
        alt: w.alt,
        image_id: media.id,
        description: w.description ?? null,
        subject: w.subject ?? [],
        style: w.style ?? [],
        composition: w.composition ?? [],
        linework: w.linework ?? [],
        mood: w.mood ?? [],
        placement: w.placement ?? null,
        colour: w.colour ?? null,
        tags: w.tags ?? [],
        metadata_status: w.metadataStatus,
        published: true,
        sort_order: i,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    workIds.set(w.id, row.id);
    log.push(`work ${w.id}`);
  }

  // ---- the home page's words: published as version 1 ----
  const home = await db.selectFrom('content_documents').select('key').where('key', '=', 'home').executeTakeFirst();
  if (!home) {
    await db.transaction().execute(async (tx) => {
      await tx.insertInto('content_documents').values({ key: 'home', draft: JSON.stringify(SITE_CONTENT) as never, published_version: 1 }).execute();
      await tx.insertInto('content_versions').values({ key: 'home', version: 1, data: JSON.stringify(SITE_CONTENT) as never }).execute();
    });
    log.push('home content v1');
  }

  // ---- journal and canvas calls (demo today, marked so) ----
  const posts = JOURNAL.status === 'awaiting' ? [] : JOURNAL.posts;
  const calls = CANVAS_CALLS.status === 'awaiting' ? [] : CANVAS_CALLS.calls;
  const postIds = new Map<string, string>();
  for (const p of posts) {
    const found = await db.selectFrom('journal_posts').select('id').where('slug', '=', p.slug).executeTakeFirst();
    if (found) {
      postIds.set(p.slug, found.id);
      continue;
    }
    const r = await db
      .insertInto('journal_posts')
      .values({
        slug: p.slug,
        kind: p.kind,
        title: p.title,
        date: p.date,
        summary: p.summary,
        body: JSON.stringify(p.body) as never,
        image: p.image ? (JSON.stringify(p.image) as never) : null,
        event: p.event ? (JSON.stringify(p.event) as never) : null,
        published: true,
        demo: !!p.demo,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    postIds.set(p.slug, r.id);
    for (const wid of p.workIds ?? []) if (workIds.has(wid)) await db.insertInto('journal_post_works').values({ post_id: r.id, work_id: workIds.get(wid)! }).onConflict((oc) => oc.doNothing()).execute();
    log.push(`post ${p.slug}`);
  }
  const callIds = new Map<string, string>();
  for (const [i, c] of calls.entries()) {
    const found = await db.selectFrom('canvas_calls').select('id').where('slug', '=', c.slug).executeTakeFirst();
    if (found) {
      callIds.set(c.slug, found.id);
      continue;
    }
    const r = await db
      .insertInto('canvas_calls')
      .values({
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        description: JSON.stringify(c.description) as never,
        status: c.status,
        artwork: JSON.stringify(c.artwork) as never,
        placement: c.placement ?? null,
        scale: c.scale ?? null,
        offer: c.offer ?? null,
        eligibility: c.eligibility ?? [],
        deadline: c.deadline ?? null,
        event_post_id: c.eventSlug ? (postIds.get(c.eventSlug) ?? null) : null,
        published: true,
        demo: !!c.demo,
        sort_order: i,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    callIds.set(c.slug, r.id);
    for (const wid of c.workIds ?? []) if (workIds.has(wid)) await db.insertInto('canvas_call_works').values({ call_id: r.id, work_id: workIds.get(wid)! }).onConflict((oc) => oc.doNothing()).execute();
    log.push(`call ${c.slug}`);
  }
  for (const p of posts)
    for (const s of p.callSlugs ?? [])
      if (postIds.has(p.slug) && callIds.has(s))
        await db.insertInto('journal_post_calls').values({ post_id: postIds.get(p.slug)!, call_id: callIds.get(s)! }).onConflict((oc) => oc.doNothing()).execute();

  // ---- testimonials: fictional demo entries (no consent exists - none is invented) ----
  const testimonials = CLIENT_EXPERIENCES.status === 'awaiting' ? [] : CLIENT_EXPERIENCES.testimonials;
  for (const [i, t] of testimonials.entries()) {
    const isDemo = 'demo' in t && t.demo === true;
    const consent = 'consent' in t ? t.consent : undefined;
    const r = await db
      .insertInto('testimonials')
      .values({
        ext_id: t.id,
        quote: t.quote,
        attribution: t.attribution,
        context: t.context ?? null,
        work_id: !isDemo && 'workId' in t && t.workId ? (workIds.get(t.workId) ?? null) : null,
        consent_date: consent?.date ?? null,
        consent_via: consent?.via ?? null,
        published: true,
        demo: isDemo,
        sort_order: i,
      })
      .onConflict((oc) => oc.column('ext_id').doNothing())
      .returningAll()
      .executeTakeFirst();
    if (r) log.push(`testimonial ${t.id}`);
  }
  return log;
}

export { publicRef } from '../../lib/crypto.ts';

export async function seedDemo(db: DB, now = new Date()) {
  const already = await db.selectFrom('inquiries').select(sql<number>`count(*)::int`.as('n')).where('demo', '=', true).executeTakeFirstOrThrow();
  if (already.n > 0) return ['demo records already present - left as they are'];
  const { demoOverview } = await import('../../../../src/dashboard/data/demoOverview.ts');
  const o = demoOverview(now);
  const log: string[] = [];

  await db.transaction().execute(async (tx) => {
    const clientOf = new Map<string, string>();
    const client = async (name: string) => {
      if (!clientOf.has(name)) {
        const r = await tx.insertInto('clients').values({ name, demo: true }).returning('id').executeTakeFirstOrThrow();
        clientOf.set(name, r.id);
      }
      return clientOf.get(name)!;
    };
    const inquiryOf = new Map<string, string>();
    for (const [i, q] of o.inquiries.entries()) {
      const r = await tx
        .insertInto('inquiries')
        .values({
          public_ref: `DEMO-${pad(i + 1)}`,
          client_id: await client(q.clientName),
          status: q.status,
          entry: JSON.stringify(q.entry) as never,
          summary: JSON.stringify(q.summary) as never,
          contact: JSON.stringify({ name: q.clientName }) as never,
          demo: true,
          submitted_at: q.receivedAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      inquiryOf.set(q.clientName, r.id);
    }
    for (const a of o.appointments)
      await tx
        .insertInto('appointments')
        .values({
          client_id: await client(a.clientName),
          inquiry_id: inquiryOf.get(a.clientName) ?? null,
          kind: a.kind,
          title: a.title,
          starts_at: a.startsAt,
          ends_at: a.endsAt,
          status: a.status,
          prep: a.prep ?? null,
          demo: true,
        })
        .execute();
    for (const f of o.followUps)
      await tx
        .insertInto('follow_ups')
        .values({ client_id: await client(f.clientName), inquiry_id: inquiryOf.get(f.clientName) ?? null, kind: f.kind, reason: f.reason, due_at: f.dueAt, demo: true })
        .execute();
    for (const a of o.activity)
      await tx
        .insertInto('activity_log')
        .values({ at: a.at as never, actor_type: a.actor === 'you' ? 'user' : a.actor, action: 'demo.event', subject_type: null, subject_id: null, data: JSON.stringify({ text: a.text, demo: true }) as never })
        .execute();
    log.push(`${o.inquiries.length} sample inquiries, ${clientOf.size} sample clients, ${o.appointments.length} appointments, ${o.followUps.length} follow-ups`);
  });
  return log;
}
