# Younes Tattoo

Site for YOUNES / TATTOO, Detroit, Michigan. React + TypeScript + Vite.

```bash
npm run dev      # local dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## Structure

- `src/sections/Hero.tsx` - the name, the artist's portrait printed into it (pointer reveal, parallax, breathing) and the Ask Younes dial. Publishes `--hero-q` / `--hero-p` on `:root` so the nav and the Work section can time their hand-off from the hero's scroll.
- Hero ink - exactly three elements, cut from licensed footage (`docs/INK_ASSETS.md`): `components/hero/InkField.tsx`, a very large, almost transparent ink field (a real ink pool, let spread into the paper) landing in the browser's top-left corner and spreading in behind the artist's head - the same life as the drops, on a ~38s cycle; `components/hero/InkDrops.tsx`, one medium (soft) and one small (defined, with spray) mark on their own randomly phased cycles. Self-contained: remove the two components, their CSS, `src/assets/ink/`, `scripts/build-ink.py` and the doc, and their lines and refs in Hero.
- `src/sections/Work.tsx` - the tattoo archive (`components/work/`): gallery, items, captions and a focused viewer.
- `src/data/work.ts` - the work itself. Neutral labels only; no client/placement/date metadata exists yet, so none is shown.
- `src/components/Consultation/` - the Ask Younes shell. No voice/AI backend yet; every Ask Younes entry point opens this panel.

## Image pipelines (offline, Python)

The ink in `src/assets/ink/` is made from two Pexels clips of real ink on paper (licence and sources: `docs/INK_ASSETS.md`). Download them into `assets-src/ink/` (git-ignored), then (needs numpy, scipy, Pillow, ffmpeg or `pip install imageio-ffmpeg`):

```bash
python scripts/build-ink.py
```

Portrait plates in `src/assets/hero/`, generated from the original studio photograph `assets-src/artist.png` (not served; needs `rembg[cpu]`, and the birefnet-portrait model is a one-off ~1 GB download):

```bash
python scripts/process-artist.py assets-src/artist.png src/assets/hero
```

- `artist-print.webp`: the rest plate
- `artist-develop.webp`: the reveal plate inside the cursor loupe. Replace it with a real tattoo layer (same size and registration) when one exists; no code changes needed.

Tattoo photographs: originals live untouched in `public/work/`. Responsive WebP copies (served by the gallery) go to `public/work/web/` (needs Pillow):

```bash
python scripts/build-work-images.py
```

After adding or replacing a photo, re-run it and update `src/data/work.ts`.

`public/youness_tattoo_logo-640.webp` and `public/favicon.png` (the crown) are derived from `public/youness_tattoo_logo.png`.
