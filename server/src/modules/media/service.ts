import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import sharp, { type Metadata } from 'sharp';
import type { DB, Executor } from '../../db/index.ts';
import type { ImageVariantRow } from '../../db/types.ts';
import { sha256hex } from '../../lib/crypto.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import type { Storage } from '../../lib/storage.ts';
import { record } from '../audit/service.ts';

/**
 * Images in, safely:
 * - what a file *is* comes from its bytes (its signature), never its name
 *   or the type the browser claimed - JPEG, PNG, WebP or AVIF only;
 * - at most 20 MB (multipart limit) and 8000 px a side (no decompression bombs);
 * - re-encoded by sharp: rotated upright, every bit of metadata (EXIF, GPS)
 *   dropped, and written as WebP at the widths the site serves;
 * - stored under a generated id - the uploaded file name is never used.
 * Public images (the portfolio) and private ones (a client's references)
 * live under different roots and are served by different routes.
 */

export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
export const MAX_SIDE = 8000;
const WIDTHS = [640, 1125, 1600];
const MAX_STORED_WIDTH = 2400;

export async function ingestImage(
  db: DB,
  storage: Storage,
  input: { data: Buffer; visibility: 'public' | 'private'; folder: string; alt?: string; userId: string | null },
) {
  const type = await fileTypeFromBuffer(input.data);
  if (!type || !IMAGE_TYPES.has(type.mime)) throw badRequest('Only JPEG, PNG, WebP or AVIF images can be uploaded.', { file: 'Not a supported image' });

  let meta: Metadata;
  try {
    meta = await sharp(input.data, { limitInputPixels: MAX_SIDE * MAX_SIDE, failOn: 'error' }).metadata();
  } catch {
    throw badRequest('That image couldn’t be read - it may be damaged.', { file: 'Unreadable image' });
  }
  if (!meta.width || !meta.height || meta.width > MAX_SIDE || meta.height > MAX_SIDE) throw badRequest(`Images can be at most ${MAX_SIDE} pixels on a side.`, { file: 'Too large' });

  const sha = sha256hex(input.data);
  const twin = await db.selectFrom('media_assets').select(['id']).where('sha256', '=', sha).where('visibility', '=', input.visibility).where('deleted_at', 'is', null).executeTakeFirst();
  if (twin) return { id: twin.id, reused: true };

  const id = randomUUID();
  const now = new Date();
  const base = `${input.visibility}/${input.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}`;
  // upright first, so width and height are what a viewer sees
  const upright = sharp(input.data, { limitInputPixels: MAX_SIDE * MAX_SIDE }).rotate();
  const { width: w, height: h } = await upright.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const widths = [...new Set([...WIDTHS.filter((x) => x < w), Math.min(w, MAX_STORED_WIDTH)])].sort((a, b) => a - b);

  const variants: ImageVariantRow[] = [];
  const written: string[] = [];
  try {
    for (const width of widths) {
      const out = await upright.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const key = `${base}-${width}.webp`;
      await storage.put(key, out);
      written.push(key);
      variants.push({ key, width, format: 'webp', bytes: out.length });
    }
    const top = variants[variants.length - 1];
    await db.transaction().execute(async (tx) => {
      await tx
        .insertInto('media_assets')
        .values({
          id,
          visibility: input.visibility,
          kind: 'image',
          mime: 'image/webp',
          bytes: top.bytes,
          width: w,
          height: h,
          sha256: sha,
          storage_key: top.key,
          variants: JSON.stringify(variants) as never,
          alt: input.alt ?? null,
          origin: `upload:${type.mime}`,
          created_by: input.userId,
        })
        .execute();
      await record(tx, input.userId ? { type: 'user', id: input.userId } : { type: 'system' }, 'media.uploaded', { type: 'media', id }, { visibility: input.visibility, width: w, height: h });
    });
  } catch (e) {
    // nothing half-stored: files written for a failed upload are removed
    await Promise.all(written.map((k) => storage.delete(k)));
    throw e;
  }
  return { id, reused: false };
}

export async function asset(db: Executor, id: string) {
  const a = await db.selectFrom('media_assets').selectAll().where('id', '=', id).where('deleted_at', 'is', null).executeTakeFirst();
  if (!a) throw notFound();
  return a;
}

/** the variant closest to (at least) a width, or the largest */
export function pickVariant(variants: ImageVariantRow[], width?: number) {
  const sorted = [...variants].sort((a, b) => a.width - b.width);
  return (width && sorted.find((v) => v.width >= width)) || sorted[sorted.length - 1];
}

/**
 * Orphans: an asset marked deleted more than a week ago, and nothing uses
 * it - its files and row go. Stray files with no row at all (a crash
 * between writing and recording) go after a day.
 */
export async function cleanupMedia(db: DB, storage: Storage, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const dead = await db
    .selectFrom('media_assets as m')
    .select(['m.id', 'm.variants'])
    .where('m.deleted_at', '<', weekAgo)
    .where((eb) => eb.not(eb.exists(eb.selectFrom('works').select('id').whereRef('works.image_id', '=', 'm.id'))))
    .where((eb) => eb.not(eb.exists(eb.selectFrom('inquiry_references').select('id').whereRef('inquiry_references.media_id', '=', 'm.id'))))
    .execute();
  for (const d of dead) {
    for (const v of d.variants) await storage.delete(v.key);
    await db.deleteFrom('media_assets').where('id', '=', d.id).execute();
  }
  const known = new Set((await db.selectFrom('media_assets').select('variants').execute()).flatMap((r) => r.variants.map((v) => v.key)));
  let strays = 0;
  for (const root of ['public', 'private']) {
    for (const key of await storage.list(root)) {
      if (known.has(key)) continue;
      // only files we generate (uuid-width.webp) - never anything placed by hand
      if (!/\/[0-9a-f-]{36}-\d+\.webp$/.test(key)) continue;
      strays++;
      await storage.delete(key);
    }
  }
  return { removed: dead.length, strays };
}
