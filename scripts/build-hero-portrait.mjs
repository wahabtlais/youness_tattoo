// The hero portrait at its approved clarity (design audit, Nov 2026: "option 1").
//
// The two plates in src/assets/hero are the same cut-out photograph:
//   artist-print.webp    the soft editorial plate (smoothed skin, lifted mids)
//   artist-develop.webp  the sharp plate (clarity, deep blacks, over-sharpened)
// The hero shows a 60/40 mix of the two: the eyes, brows and beard come
// forward, the skin stays natural. Mixed in linear light, colour only - the
// alpha (his silhouette and the fade at the bottom) is the print's, exactly,
// so the knock-out type, which is masked by this same image, stays in register.
//
// Writes public/hero/younes-640.webp and younes-1000.webp: fixed names, so
// index.html can preload the one the browser will use before any JavaScript
// runs. Re-run after replacing either plate:
//   node scripts/build-hero-portrait.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARP = 0.4;
const toLinear = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

const read = (f) => sharp(path.join(ROOT, 'src/assets/hero', f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const [print, develop] = await Promise.all([read('artist-print.webp'), read('artist-develop.webp')]);
const { width, height } = print.info;
if (develop.info.width !== width || develop.info.height !== height) throw new Error('the plates must be the same size');

const out = Buffer.alloc(print.data.length);
for (let i = 0; i < out.length; i += 4) {
  for (let c = 0; c < 3; c++) {
    out[i + c] = toSrgb((1 - SHARP) * toLinear(print.data[i + c]) + SHARP * toLinear(develop.data[i + c]));
  }
  out[i + 3] = print.data[i + 3];
}

await mkdir(path.join(ROOT, 'public/hero'), { recursive: true });
for (const w of [640, 1000]) {
  const file = path.join(ROOT, `public/hero/younes-${w}.webp`);
  // alphaQuality 100: the silhouette edge is also the type's mask
  await sharp(out, { raw: { width, height, channels: 4 } }).resize({ width: w }).webp({ quality: 84, alphaQuality: 100, effort: 6 }).toFile(file);
  console.log(path.relative(ROOT, file));
}
