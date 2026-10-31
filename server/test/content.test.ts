import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { injectContent, serializeForHtml } from '@younes/contracts';
import { seedContent } from '../src/db/seed/index.ts';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inlineScriptHashes } from '../src/modules/content/site.ts';
import { makeCtx, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

let ctx: Ctx;
let cookie: string;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await resetDb(ctx);
  await seedContent(ctx.db, ctx.storage);
  cookie = (await signIn(ctx)).cookie;
});

const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  ctx.app.inject({ method, url, payload, headers: { ...STUDIO, cookie } });
const publicContent = async () => (await ctx.app.inject({ method: 'GET', url: '/api/public/content' })).json();

describe('the public bundle', () => {
  it('holds the imported site: version 1, the 8 pieces, journal, calls, testimonials', async () => {
    const b = await publicContent();
    expect(b.version).toBe(1);
    expect(b.site.artist.headline).toBe('Every print on that line is his work.');
    expect(b.works).toHaveLength(8);
    expect(b.works[0]).toMatchObject({ id: '01', slug: '01', metadataStatus: 'demo' });
    expect(b.works[0].image.variants[0].src).toMatch(/^\/media\/public\/works\/01-\d+\.webp$/);
    expect(b.journal.every((p: { demo?: boolean }) => p.demo)).toBe(true);
    expect(b.calls).toHaveLength(5);
    expect(b.testimonials.every((t: { demo: boolean }) => t.demo)).toBe(true);
  });

  it('answers 304 to an unchanged ETag', async () => {
    const first = await ctx.app.inject({ method: 'GET', url: '/api/public/content' });
    const again = await ctx.app.inject({ method: 'GET', url: '/api/public/content', headers: { 'if-none-match': first.headers.etag as string } });
    expect(again.statusCode).toBe(304);
  });

  it('the published images are served, cached for a day; nothing outside storage is', async () => {
    const b = await publicContent();
    const img = await ctx.app.inject({ method: 'GET', url: b.works[0].image.src });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/webp');
    expect(img.headers['cache-control']).toBe('public, max-age=86400');
    for (const url of ['/media/public/../../server/.env', '/media/public/..%2F..%2Fserver%2F.env', '/media/public/works/nope.webp', '/media/private/x.webp']) {
      expect((await ctx.app.inject({ method: 'GET', url })).statusCode, url).toBe(404);
    }
  });
});

describe('drafts, publishing and rollback', () => {
  it('a saved draft stays private until published; publishing makes it the next version', async () => {
    const state = (await call('GET', '/api/studio/content/home')).json();
    expect(state).toMatchObject({ hasDraft: false, published: { version: 1 }, delivery: 'not-connected' });
    const draft = { ...state.draft, artist: { ...state.draft.artist, headline: 'A new line for the artist.' }, visible: { ...state.draft.visible, process: false } };
    expect((await call('PUT', '/api/studio/content/home/draft', { draft })).statusCode).toBe(200);

    // the public never sees the draft; the preview needs the owner
    expect((await publicContent()).site.artist.headline).toBe('Every print on that line is his work.');
    expect((await ctx.app.inject({ method: 'GET', url: '/api/studio/content/home/preview' })).statusCode).toBe(401);
    const preview = await call('GET', '/api/studio/content/home/preview');
    expect(preview.json().site.artist.headline).toBe('A new line for the artist.');
    expect(preview.headers['cache-control']).toContain('no-store');

    const pub = await call('POST', '/api/studio/content/home/publish');
    expect(pub.json()).toEqual({ version: 2 });
    const live = await publicContent();
    expect(live.version).toBe(2);
    expect(live.site.artist.headline).toBe('A new line for the artist.');
    expect(live.site.visible.process).toBe(false);
    expect((await call('POST', '/api/studio/content/home/publish')).statusCode).toBe(409);
  });

  it('refuses an invalid draft and keeps the last good one', async () => {
    const state = (await call('GET', '/api/studio/content/home')).json();
    const bad = { ...state.draft, artist: { ...state.draft.artist, headline: '' } };
    const r = await call('PUT', '/api/studio/content/home/draft', { draft: bad });
    expect(r.statusCode).toBe(400);
    expect(r.json().fields['artist.headline']).toMatch(/Required/);
    const html = { ...state.draft, book: { intro: 'x'.repeat(161) } };
    expect((await call('PUT', '/api/studio/content/home/draft', { draft: html })).statusCode).toBe(400);
    expect((await call('GET', '/api/studio/content/home')).json().draft.artist.headline).toBe('Every print on that line is his work.');
  });

  it('rolls back by republishing an old version as a new one - history only grows', async () => {
    const state = (await call('GET', '/api/studio/content/home')).json();
    await call('PUT', '/api/studio/content/home/draft', { draft: { ...state.draft, book: { intro: 'Second wording.' } } });
    await call('POST', '/api/studio/content/home/publish');
    const back = await call('POST', '/api/studio/content/home/rollback', { version: 1 });
    expect(back.json()).toEqual({ version: 3 });
    const after = (await call('GET', '/api/studio/content/home')).json();
    expect(after.published.version).toBe(3);
    expect(after.versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    expect(after.draft.book.intro).toBe(state.draft.book.intro);
    expect((await publicContent()).site.book.intro).toBe(state.draft.book.intro);
    expect((await call('POST', '/api/studio/content/home/rollback', { version: 99 })).statusCode).toBe(404);
  });

  it('discarding the draft returns it to what’s published', async () => {
    const state = (await call('GET', '/api/studio/content/home')).json();
    await call('PUT', '/api/studio/content/home/draft', { draft: { ...state.draft, book: { intro: 'Unwanted.' } } });
    expect((await call('GET', '/api/studio/content/home')).json().hasDraft).toBe(true);
    await call('DELETE', '/api/studio/content/home/draft');
    expect((await call('GET', '/api/studio/content/home')).json()).toMatchObject({ hasDraft: false });
  });

  it('unpublishing a journal post or a piece takes it out of the bundle', async () => {
    const posts = (await call('GET', '/api/studio/journal')).json();
    await call('PATCH', `/api/studio/journal/${posts[0].id}`, { published: false });
    expect((await publicContent()).journal.map((p: { slug: string }) => p.slug)).not.toContain(posts[0].slug);
    const works = (await call('GET', '/api/studio/works')).json();
    await call('PATCH', `/api/studio/works/${works[0].id}`, { published: false });
    expect((await publicContent()).works).toHaveLength(7);
  });

  it('an unpublished piece is never named by the posts, calls or testimonials that show it', async () => {
    const before = await publicContent();
    const used = new Set<string>([...before.journal, ...before.calls].flatMap((x: { workIds?: string[] }) => x.workIds ?? []));
    for (const t of before.testimonials as { workId?: string }[]) if (t.workId) used.add(t.workId);
    expect(used.size).toBeGreaterThan(0);
    const works = (await call('GET', '/api/studio/works')).json() as { id: string; number: string }[];
    for (const w of works.filter((x) => used.has(x.number))) await call('PATCH', `/api/studio/works/${w.id}`, { published: false });
    const after = await publicContent();
    const named = [...after.journal, ...after.calls].flatMap((x: { workIds?: string[] }) => x.workIds ?? []).concat((after.testimonials as { workId?: string }[]).flatMap((t) => (t.workId ? [t.workId] : [])));
    expect(named.filter((n: string) => used.has(n))).toEqual([]);
  });
});

describe('content inside the page', () => {
  it('can’t break out of its script element', () => {
    const evil = { a: '</script><script>alert(1)</script>', b: '<!--', c: String.fromCharCode(0x2028, 0x2029), d: 'R&D' };
    const s = serializeForHtml(evil);
    expect(s).not.toMatch(new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']'));
    expect(JSON.parse(s)).toEqual(evil);
    const page = injectContent('<html><head><title>x</title></head><body></body></html>', evil);
    expect(page.match(/<\/script>/g)).toHaveLength(1);
    expect(injectContent(page, { again: true })).toBe(page);
  });
});

describe('the served page and its security policy', () => {
  const theme = "\n      try { document.documentElement.dataset.x = '1'; } catch (e) {}\n    ";
  const html = '<html><head><script>' + theme + '</script><script type="application/json" id="d">{"a":1}</script></head><body><script type="module" src="/assets/app.js"></script></body></html>';
  const hash = "'sha256-" + createHash('sha256').update(theme, 'utf8').digest('base64') + "'";

  it('hashes exactly the inline scripts - not data blocks, not external files', () => {
    expect(inlineScriptHashes(html)).toEqual([hash]);
    // as a browser parses it: CRLF line breaks hash as LF
    expect(inlineScriptHashes(html.replaceAll('\n', '\r\n'))).toEqual([hash]);
  });

  it('the page’s own inline script is allowed by hash; nothing else inline is', async () => {
    const dist = await mkdtemp(path.join(tmpdir(), 'younes-dist-'));
    await writeFile(path.join(dist, 'index.html'), html);
    const site = await makeCtx({ env: { SERVE_SITE: 'true', SITE_DIST_DIR: dist } });
    try {
      await seedContent(site.db, site.storage);
      const r = await site.app.inject({ method: 'GET', url: '/work/04' });
      expect(r.statusCode).toBe(200);
      const csp = String(r.headers['content-security-policy']);
      const scripts = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
      expect(scripts.trim()).toBe("script-src 'self' " + hash);
      expect(scripts).not.toContain('unsafe-inline');
      // the published content is in the page
      expect(r.body).toContain('id="younes-content"');
    } finally {
      await site.close();
      await rm(dist, { recursive: true, force: true });
    }
  });
});
