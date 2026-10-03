# Ink assets

The hero has exactly three ink elements, made from real, licensed ink material: one very large ink field entering from the browser's top-left corner behind the artist (`src/components/hero/InkField.tsx`), one medium and one small mark (`src/components/hero/InkDrops.tsx`). Every external asset used is listed here.

## Assets in use

### 1. "Drops of Black Ink on White Paper"

| | |
|---|---|
| Source | https://www.pexels.com/video/drops-of-black-ink-on-white-paper-6268212/ |
| Creator | Miguel Á. Padriñán (Pexels) |
| Licence | [Pexels License](https://www.pexels.com/license/) |
| Commercial website use | Yes |
| Attribution required | No (appreciated, not required) |
| Modification allowed | Yes |
| Restrictions | Don't sell unaltered copies; don't redistribute on competing stock platforms; don't imply endorsement by people/brands shown (none shown here) |
| Downloaded | 2026-10-01 |
| Local source file | `assets-src/ink/pexels-6268212-padrinan.mp4` (git-ignored, 4K, 18 MB) |
| Used for | `src/assets/ink/ink-small.webp`, the small mark - an impact with its ring of radial spray (5.4-10.75 s) |

### 2. "Splatters of Black Ink on a White Surface"

| | |
|---|---|
| Source | https://www.pexels.com/video/splatters-of-black-ink-on-a-white-surface-6268211/ |
| Creator | Miguel Á. Padriñán (Pexels) |
| Licence | [Pexels License](https://www.pexels.com/license/) |
| Commercial website use | Yes |
| Attribution required | No |
| Modification allowed | Yes |
| Restrictions | As above |
| Downloaded | 2026-10-01 |
| Local source file | `assets-src/ink/pexels-6268211-padrinan.mp4` (git-ignored, 4K, 6 MB) |
| Used for | `src/assets/ink/ink-medium.webp`, the medium mark (1.6-5.65 s, rendered soft); `src/assets/ink/ink-large.webp`, the very large field (9 real frames, 8.75-10.75 s: the first drops landing and merging into the pool in the shot's top-left corner, keyed and let spread into the paper, 720x440 each) |

Licence terms were read on the Pexels licence page and the photo page itself on the download date, not taken from search results. The shipped files are heavily transformed (cropped, keyed to alpha, re-timed or re-shaped, small WebP strips); no unaltered copy of any source is distributed.

## How the shipped files are made

```bash
# download both clips into assets-src/ink/ with the names above, then
python scripts/build-ink.py                        # all three
python scripts/build-ink.py src/assets/ink drops   # small + medium only
python scripts/build-ink.py src/assets/ink large   # the very large field only
```

`scripts/build-ink.py` (needs numpy, scipy, Pillow and ffmpeg - on PATH or via `pip install imageio-ffmpeg`) keys the ink off the paper by brightness. For the small and medium marks it keeps only the frames where the ink changes, at their real timings (the medium is then softened into a spreading mark). For the very large field it takes real frames of the pool growing in the corner of the shot and lets each spread into the paper: a wet front that creeps outward following the pool's own shape, uneven pigment, a feathered fringe and a faint dried tide line. Output: three transparent WebP strips plus `drops.json` / `ink-large.json`. No source footage is shipped.

## Considered and not used

| Asset / source | Why not |
|---|---|
| `Video Project 9.mp4` (provided) | Used only as a visual reference. Origin and licence unknown, so none of its pixels are used. Moved out of `public/` to `assets-src/reference/` (git-ignored) so it is never shipped. |
| Mirin's Stock Footage (https://miirriin.com/en/terms-conditions/) | Free for commercial use, but the terms forbid files being "posted on any website for others to download or copy". Serving derived frames from a website is arguably that, so the licence is unclear for this use. |
| Vecteezy free ink alpha footage (https://www.vecteezy.com/licensing-agreement) | Free licence requires attribution; attribution-free use needs a paid Pro licence. |
| "Black and White Abstract Painting", Kseniya Lapteva (https://www.pexels.com/photo/black-and-white-abstract-painting-9176028/, Pexels licence) | Tried as the source for the large field (a scanned ink wash). Not used: the artist preferred the softer version made from the "Splatters" pool. The original remains in `assets-src/ink/` (git-ignored). |
| Rawpixel | Licence page could not be verified (blocked to automated access); not used. |
| Transparent WebM/HEVC alpha video in general | VP9 alpha WebM does not play with transparency in Safari/iOS; the HEVC-alpha fallback needs macOS to encode. The WebP frame strips work in every browser. |

## Optional paid alternative

Paid alpha ink libraries (e.g. Vecteezy Pro, Envato Elements, ActionVFX) offer longer, softer ink-spread events closer to the provided reference's feathered edge. None was purchased. If one is licensed later, drop the clip into `assets-src/ink/`, add an event to `scripts/build-ink.py`, and record it here.
