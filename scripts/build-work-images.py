"""
Responsive web copies of the tattoo photographs.

usage: python scripts/build-work-images.py

Reads every image in public/work/ (the untouched originals) and writes
WebP copies to public/work/web/<name>-<width>.webp at 640px and at the
source width (capped at 1280; the 640 step is skipped for sources barely
larger than it). The gallery serves these through srcset;
the originals are never modified. Only needs Pillow. Re-run after adding
or replacing a photo, then update src/data/work.ts.
"""

from pathlib import Path

from PIL import Image, ImageOps

SRC = Path("public/work")
OUT = SRC / "web"
WIDTHS = (640, 1280)
QUALITY = 84

OUT.mkdir(exist_ok=True)

for path in sorted(p for p in SRC.iterdir() if p.is_file()):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = im.size
    # skip a step that would be a near-duplicate of the source
    sizes = sorted({min(w, t) if w > t * 1.15 else w for t in WIDTHS})
    for width in sizes:
        out = OUT / f"{path.stem}-{width}.webp"
        copy = im if width == w else im.resize((width, round(h * width / w)), Image.LANCZOS)
        copy.save(out, "WEBP", quality=QUALITY, method=6)
        print(f"{out}  {copy.size[0]}x{copy.size[1]}  {out.stat().st_size // 1024} KB")
