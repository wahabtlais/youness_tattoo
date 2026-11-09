// The official logo for the ink chapters (the Artist's black stock, the
// booking and the footer): public/youness_tattoo_logo_dark.png is the mark in
// white and red on solid black. This lifts the black out - each pixel's
// colour divided by its brightness, which becomes its opacity - so it sits on
// any dark stock exactly as it does on black, and writes a 640px WebP like
// the light logo's.
//   node scripts/build-logo-dark.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { data, info } = await sharp(path.join(ROOT, 'public/youness_tattoo_logo_dark.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.alloc(info.width * info.height * 4);
for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
  const a = Math.max(data[i], data[i + 1], data[i + 2]);
  // near-black is background: fully transparent
  const alpha = a < 12 ? 0 : a;
  for (let c = 0; c < 3; c++) out[j + c] = alpha ? Math.min(255, Math.round((data[i + c] * 255) / alpha)) : 0;
  out[j + 3] = alpha;
}
const file = path.join(ROOT, 'public/youness_tattoo_logo-dark-640.webp');
await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).resize({ width: 640 }).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
console.log(path.relative(ROOT, file));
