"""Hero portrait pipeline (offline, not part of the app build).

usage: python scripts/process-artist.py assets-src/artist.png src/assets/hero
(needs `pip install "rembg[cpu]" pillow numpy`; the birefnet-portrait model is
a one-off ~1 GB download. Also writes a preview.jpg next to the output dir)

assets-src/artist.png is the original studio photograph (RGB, dark backdrop,
blue/orange grade). Keep it out of public/ - it isn't served.
  -> cutout via rembg (birefnet-portrait). isnet-general-use, used before,
     dropped the shirt below his left elbow and along the lower torso where
     black fabric meets the dark backdrop.
  -> neutral monochrome, gentle contrast curve
  -> two layers with identical alpha:
       artist-print.webp    rest plate: soft, lower local contrast, still deep blacks
       artist-develop.webp  reveal plate: sharper, clarity + micro-detail (tattoo layer goes here later)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

src = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

img = Image.open(src).convert("RGB")
session = new_session("birefnet-portrait")
mask = remove(img, session=session, only_mask=True)
alpha = np.asarray(mask).astype(np.float32) / 255.0

# soften the matte edge a touch so hair doesn't read as a sticker, then pull
# the half-transparent rim in slightly: those pixels carry the dark backdrop
# and would otherwise draw a grey outline on the light paper
a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
alpha = np.asarray(a_img).astype(np.float32) / 255.0
alpha = np.clip((alpha - 0.06) / 0.94, 0, 1) ** 1.15

# bottom fade: the torso dissolves into the page instead of a hard crop line
h, w = alpha.shape
yy = np.linspace(0, 1, h)[:, None]
fade = np.clip((0.975 - yy) / 0.3, 0, 1) ** 1.6
alpha = alpha * fade

rgb = np.asarray(img).astype(np.float32) / 255.0
# luminance only - drops the cinematic blue/orange entirely
lum = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722

# a soft pool of light on the face, found from the matte rather than
# hard-coded: centred on the head's columns, a little below its top
cols = np.where(alpha[: h // 3].max(axis=0) > 0.5)[0]
rows = np.where(alpha.max(axis=1) > 0.5)[0]
fx = (cols.min() + cols.max()) / 2 if cols.size else w / 2
fy = (rows.min() if rows.size else 0) + h * 0.12
xx = np.arange(w)[None, :]
face_light = np.exp(-(((xx - fx) / (w * 0.16)) ** 2 + ((np.arange(h)[:, None] - fy) / (h * 0.1)) ** 2))


def curve(x, black, white, gamma):
    x = np.clip((x - black) / (white - black), 0, 1)
    return x ** gamma


def smooth_s(x, k):
    # mild S-curve around mid-grey
    return 0.5 + (x - 0.5) * (1 + k) / (1 + k * np.abs(2 * x - 1))


def to_rgba(l, tint):
    # tiny warm-neutral tint so shadows sit on #F3F1EC paper rather than blue-black
    r = np.clip(l * tint[0], 0, 1)
    g = np.clip(l * tint[1], 0, 1)
    b = np.clip(l * tint[2], 0, 1)
    arr = np.stack([r, g, b, alpha], axis=-1)
    return Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "RGBA")


def blur(x, r):
    im = Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0


# rest ("print"): what the page shows with no cursor. Still a strong
# portrait - deep blacks - but slightly soft and lower in local contrast,
# like a photograph printed onto the paper.
base = curve(lum, 0.01, 0.86, 0.9)
soft = base * 0.4 + blur(base, 1.3) * 0.6
flat = soft * 0.76 + blur(soft, 24) * 0.24
prt = 0.075 + smooth_s(flat, 0.06) * 0.83
# lift the face's midtones a touch (not the beard's blacks, not the highlights)
prt = prt + 0.045 * face_light * np.clip(prt * (1 - prt) * 4, 0, 1)

# reveal ("develop"): the same photograph brought closer - local contrast
# (clarity), fine unsharp mask for skin / beard / fabric micro-detail,
# slightly deeper blacks. Registered pixel-for-pixel with the rest plate.
# The real tattoo layer replaces this file later.
d = curve(lum, 0.02, 0.88, 0.95)
# clarity is weighted by alpha so the dark studio backdrop doesn't halo the silhouette
a3 = np.clip(alpha, 1e-3, 1)
local = blur(d * a3, 14) / np.maximum(blur(a3, 14), 1e-3)
d = d + 0.28 * (d - local)
d = d + 0.65 * (d - blur(d, 1.0))
dev = 0.02 + smooth_s(np.clip(d, 0, 1), 0.14) * 0.93

tint = (1.02, 1.0, 0.975)
to_rgba(dev, tint).save(out / "artist-develop.webp", "WEBP", quality=86, method=6)
to_rgba(prt, tint).save(out / "artist-print.webp", "WEBP", quality=86, method=6)

# preview on paper for QA
paper = Image.new("RGBA", (w * 2, h), (243, 241, 236, 255))
paper.alpha_composite(to_rgba(prt, tint), (0, 0))
paper.alpha_composite(to_rgba(dev, tint), (w, 0))
paper.convert("RGB").resize((w, h // 2)).save(out.parent / "preview.jpg", quality=85)
print("done", w, h)
