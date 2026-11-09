// The Artist section's portrait: a controlled low-key lighting treatment of
// the real photograph, not a regeneration. Every pixel is the original's,
// multiplied by a smooth gain map, with the deepest shadows lifted a few
// levels to the site's ink.
//
//   node scripts/build-artist-portrait.mjs [previewDir]
//
// Source (kept byte for byte, never written): assets-src/artist-portrait-dark.png
// Output: src/assets/artist/portrait-night-1402.webp and portrait-night-700.webp
// (and, with previewDir, a full-quality PNG of the result for review).
//
// What it does, in the photograph's own pixels (1402 x 1122):
//  1. darkens the viewer-left side of the head - the cap's left edge, the
//     temple, the ear and the cheek - with feathered ellipses;
//  2. takes the highlight off the viewer-left shoulder (the bright shirt
//     print), and quietens the right shoulder's print a little;
//  3. lets the bottom of the shirt sink into the backdrop;
//  4. keeps the eyes, nose, mouth and the beard's centre exactly as shot
//     (a protected ellipse where the gain is held at 1);
//  5. lifts the black point by the difference between the backdrop (on
//     average 7,10,16) and the site's ink (#14131a = 20,19,26): the full
//     13/9/10 levels in the deepest shadows, tapering to nothing by the
//     mid-tones, so the backdrop is the page's own colour and the page can
//     fade the photograph's edges into it (Artist.css) without a seam. The
//     face's tones are left alone.
// No sharpening, smoothing or retouching: texture and detail are untouched,
// and every change is gradual across the frame.
import sharp from 'sharp';
import path from 'node:path';

const SRC = 'assets-src/artist-portrait-dark.png';
const OUT = 'src/assets/artist';
const BACKDROP = [7, 10, 16];
const INK = [0x14, 0x13, 0x1a];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// an ellipse that pulls brightness down by `amount` at its centre, fading out
// from `inner` of its radius to its edge
const shade = (cx, cy, rx, ry, amount, inner = 0.3) => (x, y) => {
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return 1 - amount * (1 - smooth(inner, 1, d));
};

const shades = [
  shade(330, 260, 140, 160, 0.3), // the cap's left edge and crown
  shade(375, 510, 115, 195, 0.5), // temple, ear, cheek (viewer-left)
  shade(110, 950, 310, 270, 0.6, 0.2), // the viewer-left shoulder and its print
  shade(840, 1040, 320, 190, 0.25), // the right shoulder's print, a little
  shade(700, 1260, 900, 300, 0.3, 0.2), // the shirt sinking into the backdrop
];
// held as shot: the eyes, nose, mouth and centre of the beard
const PROTECT = { cx: 610, cy: 540, rx: 190, ry: 230 };

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.alloc(data.length);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let g = 1;
    for (const s of shades) g *= s(x, y);
    const p = Math.hypot((x - PROTECT.cx) / PROTECT.rx, (y - PROTECT.cy) / PROTECT.ry);
    g += (1 - g) * (1 - smooth(0.7, 1.15, p));
    const i = (y * width + x) * channels;
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] * g;
      out[i + c] = Math.round(Math.min(255, v + (INK[c] - BACKDROP[c]) * (1 - smooth(0, 90, v))));
    }
  }
}

const img = () => sharp(out, { raw: { width, height, channels } });
await img().webp({ quality: 90 }).toFile(path.join(OUT, `portrait-night-${width}.webp`));
await img().resize({ width: 700 }).webp({ quality: 88 }).toFile(path.join(OUT, 'portrait-night-700.webp'));
const preview = process.argv[2];
if (preview) await img().png().toFile(path.join(preview, 'portrait-night.png'));
console.log(`portrait-night: ${width}x${height}`);
