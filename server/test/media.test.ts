import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupMedia } from '../src/modules/media/service.ts';
import { makeCtx, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

let ctx: Ctx;
let cookie: string;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await resetDb(ctx);
  cookie = (await signIn(ctx)).cookie;
});

/** a multipart body by hand: one file part (and an optional alt field) */
function multipart(file: Buffer, filename: string, type: string, alt?: string) {
  const b = '----younes-test-boundary';
  const parts: Buffer[] = [];
  if (alt) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="alt"\r\n\r\n${alt}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`), file, Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}
const upload = (file: Buffer, filename = 'photo.jpg', type = 'image/jpeg', query = '', alt?: string) => {
  const m = multipart(file, filename, type, alt);
  return ctx.app.inject({ method: 'POST', url: `/api/studio/media${query}`, payload: m.payload, headers: { ...STUDIO, cookie, ...m.headers } });
};
/** a JPEG with camera metadata (orientation, GPS-like EXIF) */
const photo = (w = 2000, h = 1500) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#7a2030' } })
    .withExif({ IFD0: { Make: 'TestCam', Model: 'Secret Model' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 20/1 0/1' } })
    .jpeg()
    .toBuffer();

describe('uploads', () => {
  it('re-encodes to WebP at the site’s widths, with every bit of metadata dropped', async () => {
    const r = await upload(await photo(), 'IMG_0001.jpg', 'image/jpeg', '', 'A test piece');
    expect(r.statusCode).toBe(201);
    const asset = await ctx.db.selectFrom('media_assets').selectAll().where('id', '=', r.json().id).executeTakeFirstOrThrow();
    expect(asset).toMatchObject({ visibility: 'public', mime: 'image/webp', width: 2000, height: 1500, alt: 'A test piece' });
    expect(asset.variants.map((v) => v.width)).toEqual([640, 1125, 1600, 2000]);
    expect(asset.storage_key).toMatch(/^public\/works\/\d{4}\/\d{2}\/[0-9a-f-]{36}-2000\.webp$/);
    expect(asset.storage_key).not.toContain('IMG_0001');
    const stored = await ctx.storage.read(asset.variants[0].key);
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('judges a file by its bytes: a disguised text file, or a lying type, is refused', async () => {
    const fake = await upload(Buffer.from('<?php echo "hi"; ?>'.repeat(20)), 'evil.jpg', 'image/jpeg');
    expect(fake.statusCode).toBe(400);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).gif().toBuffer();
    expect((await upload(gif, 'x.png', 'image/png')).statusCode).toBe(400);
    expect(await ctx.db.selectFrom('media_assets').select('id').execute()).toHaveLength(0);
  });

  it('refuses images larger than 8000 px and files over 20 MB', async () => {
    const huge = await sharp({ create: { width: 8100, height: 10, channels: 3, background: '#000' } }).png().toBuffer();
    expect((await upload(huge, 'h.png', 'image/png')).statusCode).toBe(400);
    const big = Buffer.concat([await photo(100, 100), Buffer.alloc(21 * 1024 * 1024)]);
    expect([400, 413]).toContain((await upload(big)).statusCode);
  });

  it('the same image twice is stored once', async () => {
    const p = await photo(800, 600);
    const a = await upload(p);
    const b = await upload(p);
    expect(b.statusCode).toBe(200);
    expect(b.json()).toEqual({ id: a.json().id, reused: true });
  });

  it('a private image is served only to the signed-in owner, never under /media/public', async () => {
    const r = await upload(await photo(800, 600), 'ref.jpg', 'image/jpeg', '?visibility=private');
    const id = r.json().id;
    const asset = await ctx.db.selectFrom('media_assets').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(asset.storage_key).toMatch(/^private\/references\//);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/studio/media/${id}` })).statusCode).toBe(401);
    const mine = await ctx.app.inject({ method: 'GET', url: `/api/studio/media/${id}`, headers: { cookie } });
    expect(mine.statusCode).toBe(200);
    expect(mine.headers['cache-control']).toContain('no-store');
    expect((await ctx.app.inject({ method: 'GET', url: `/media/${asset.storage_key}` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: `/media/public/${asset.storage_key.replace(/^private\//, '')}` })).statusCode).toBe(404);
  });

  it('an uploaded image becomes a portfolio piece - unpublished until checked', async () => {
    const r = await upload(await photo(1200, 1500));
    const w = await ctx.app.inject({ method: 'POST', url: '/api/studio/works', payload: { mediaId: r.json().id, alt: 'A new piece' }, headers: { ...STUDIO, cookie } });
    expect(w.statusCode).toBe(201);
    const works = (await ctx.app.inject({ method: 'GET', url: '/api/studio/works', headers: { cookie } })).json();
    expect(works[0]).toMatchObject({ number: '01', published: false, metadataStatus: 'demo', alt: 'A new piece' });
    expect((await ctx.app.inject({ method: 'GET', url: '/api/public/content' })).json().works).toHaveLength(0);
  });

  it('an unpublished piece’s image is refused to visitors even at its exact address; publishing serves it, unpublishing stops it', async () => {
    const r = await upload(await photo(1200, 1500));
    const mediaId = r.json().id as string;
    const keys = (await ctx.db.selectFrom('media_assets').select(['storage_key', 'variants']).where('id', '=', mediaId).executeTakeFirstOrThrow());
    const urls = [keys.storage_key, ...keys.variants.map((v) => v.key)].map((k) => `/media/${k}`);
    expect(urls.every((u) => u.startsWith('/media/public/'))).toBe(true);
    const status = async () => Promise.all(urls.map(async (u) => (await ctx.app.inject({ method: 'GET', url: u })).statusCode));

    // uploaded, not yet a piece: nobody can fetch it
    expect(new Set(await status())).toEqual(new Set([404]));
    // a piece, unpublished: still nobody - not even with the owner's cookie on that public route
    const workId = (await ctx.app.inject({ method: 'POST', url: '/api/studio/works', payload: { mediaId, alt: 'Private piece' }, headers: { ...STUDIO, cookie } })).json().id;
    expect(new Set(await status())).toEqual(new Set([404]));
    expect((await ctx.app.inject({ method: 'GET', url: urls[0], headers: { cookie } })).statusCode).toBe(404);
    // ...while the studio sees it through its own, signed-in route
    const studio = (await ctx.app.inject({ method: 'GET', url: '/api/studio/works', headers: { cookie } })).json() as { image: { src: string } }[];
    expect(studio[0].image.src).toMatch(/^\/api\/studio\/media\/[0-9a-f-]{36}\?w=\d+$/);
    expect((await ctx.app.inject({ method: 'GET', url: studio[0].image.src, headers: { cookie } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'GET', url: studio[0].image.src })).statusCode).toBe(401);

    // published: every file is served to anyone
    await ctx.app.inject({ method: 'PATCH', url: `/api/studio/works/${workId}`, payload: { published: true }, headers: { ...STUDIO, cookie } });
    expect(new Set(await status())).toEqual(new Set([200]));
    // taken off the site again: refused again, straight away
    await ctx.app.inject({ method: 'PATCH', url: `/api/studio/works/${workId}`, payload: { published: false }, headers: { ...STUDIO, cookie } });
    expect(new Set(await status())).toEqual(new Set([404]));
  });

  it('cleanup removes a long-deleted, unused asset and stray generated files - and nothing else', async () => {
    // files left by earlier tests in this file count as strays: clear them first
    await cleanupMedia(ctx.db, ctx.storage);
    const used = await upload(await photo(700, 500));
    await ctx.app.inject({ method: 'POST', url: '/api/studio/works', payload: { mediaId: used.json().id, alt: 'kept' }, headers: { ...STUDIO, cookie } });
    const gone = await upload(await photo(640, 480));
    await ctx.db.updateTable('media_assets').set({ deleted_at: new Date(Date.now() - 8 * 86_400_000) }).where('id', '=', gone.json().id).execute();
    await ctx.storage.put(`public/works/2026/01/${crypto.randomUUID()}-640.webp`, Buffer.from('stray'));
    await ctx.storage.put('public/works/handmade.webp', Buffer.from('placed by hand'));
    const r = await cleanupMedia(ctx.db, ctx.storage);
    expect(r).toEqual({ removed: 1, strays: 1 });
    expect(await ctx.db.selectFrom('media_assets').select('id').where('id', '=', gone.json().id).executeTakeFirst()).toBeUndefined();
    expect(await ctx.db.selectFrom('media_assets').select('id').where('id', '=', used.json().id).executeTakeFirst()).toBeTruthy();
    expect(await ctx.storage.size('public/works/handmade.webp')).not.toBeNull();
  });
});
