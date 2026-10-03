"""
The hero's three ink elements, cut from real footage. Offline.

  small + medium (InkDrops): real drop events, frame by frame
  very large (InkField): a real pool entering from the corner of the shot,
  let spread into the paper - see build_field()

usage: python scripts/build-ink.py [outdir] [drops|large]
       (default outdir: src/assets/ink; the second argument rebuilds only
       the small + medium marks, or only the very large field)
needs: numpy, scipy, pillow, and an ffmpeg binary - on PATH, or from the
       `imageio-ffmpeg` package (pip install imageio-ffmpeg)

Source: two Pexels clips of black ink dropped onto paper, filmed top-down
(licence and download links in docs/INK_ASSETS.md). Download them into
assets-src/ink/ under the names below; they are git-ignored.

For each drop event this
  1. decodes the time window at the source frame rate, luminance only,
     cropped around the event (the crop is found from the settled frame),
  2. keys the ink off the paper by brightness - black ink on light paper,
     so alpha = how much darker than the paper a pixel is; wet sheen and
     thinning edges come through as natural density variation,
  3. keeps only ink that belongs to the final mark (drops still in flight
     elsewhere in the shot and the lens vignette are dropped), then only
     the frames where that ink changes (the landing blur, each new drop
     merging in, the spray), with their real timestamps,
  4. adds the density variation of dried ink (a fixed pigment mottle,
     denser where the edge dried) without touching the shapes,
  5. writes one horizontal strip of those frames (transparent WebP) and a
     manifest the component reads: frame count, size, timings, body size.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import label

SRC = Path("assets-src/ink")
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "src/assets/ink")
OUT.mkdir(parents=True, exist_ok=True)

CHARCOAL = (22, 21, 25)

# start/end in seconds of each event in its clip; the window starts on a
# frame before the first drop lands and ends once everything has settled
EVENTS = [
    # SMALL - the defined one: blot -> a second drop merges -> impact with
    # a ring of radial spray
    {"name": "ink-small", "clip": "pexels-6268212-padrinan.mp4", "start": 5.4, "end": 10.75, "size": 300},
    # MEDIUM - blot -> elongating merge -> spray streaks, rendered soft: a
    # spreading mark rather than a crisp drop
    {"name": "ink-medium", "clip": "pexels-6268211-padrinan.mp4", "start": 1.6, "end": 5.65, "size": 240, "soft": True},
]


def ffmpeg_bin():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg  # noqa: PLC0415 - optional dependency

    return imageio_ffmpeg.get_ffmpeg_exe()


FF = ffmpeg_bin()


def probe(path):
    out = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "Video:" in line:
            w, h = (int(v) for v in re.search(r"(\d{2,5})x(\d{2,5})", line).groups())
            fps = float(re.search(r"([\d.]+) fps", line).group(1))
            return w, h, fps
    raise RuntimeError(f"cannot probe {path}")


def grey_frames(path, start, end, crop=None, scale=None):
    """luminance frames (float32, 0..255) of [start, end)"""
    w, h, fps = probe(path)
    vf = []
    if crop:
        x, y, cw, ch = crop
        vf.append(f"crop={cw}:{ch}:{x}:{y}")
        w, h = cw, ch
    if scale:
        vf.append(f"scale={scale}:{scale}:flags=area")
        w = h = scale
    vf.append("format=gray")
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-ss", f"{start}", "-t", f"{end - start}",
           "-i", str(path), "-vf", ",".join(vf), "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h)
    frames = np.frombuffer(raw[: n * w * h], np.uint8).reshape(n, h, w).astype(np.float32)
    return frames, fps


def key(lum):
    """ink alpha from luminance: paper level from the bright majority"""
    paper = np.percentile(lum, 70)
    ink = min(np.percentile(lum, 0.3), paper - 60)
    a = np.clip((paper - 6 - lum) / (paper - 6 - ink), 0, 1)
    # drop paper noise and compression speckle, keep thin edges
    return np.clip((a - 0.04) / 0.9, 0, 1)


def build(ev):
    path = SRC / ev["clip"]
    W, H, _ = probe(path)

    # 1. where does it end up? key the settled frame at a quarter resolution
    probe_frames, _ = grey_frames(path, ev["end"] - 0.05, ev["end"], scale=None)
    settled = key(probe_frames[-1])
    # centre on the main body (largest blob), so a drop sits on the page
    # where its ink landed; size the square to hold nearly all the spray
    lab, num = label(settled > 0.5)
    body = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    bys, bxs = np.where(body)
    cx, cy = bxs.mean(), bys.mean()
    ys, xs = np.where(settled > 0.25)
    reach = np.percentile(np.maximum(np.abs(xs - cx), np.abs(ys - cy)), 99.2)
    side = int(reach * 2 * 1.12)
    side = min(side, W, H)
    left = int(np.clip(cx - side / 2, 0, W - side))
    top = int(np.clip(cy - side / 2, 0, H - side))

    # 2. the window, cropped, at output resolution
    size = ev["size"]
    frames, fps = grey_frames(path, ev["start"], ev["end"], crop=(left, top, side, side), scale=size)
    alphas = [key(f) for f in frames]
    # only ink that is part of the final mark counts: drops still in flight
    # elsewhere in the shot and the lens vignette at the corners are dropped
    final = Image.fromarray(((alphas[-1] > 0.1) * 255).astype(np.uint8))
    region = np.asarray(final.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(2))) / 255.0
    alphas = [a * region for a in alphas]
    # and only ink that stays put: a falling drop is never in the same place
    # two frames running, landed ink is
    n = len(alphas)
    alphas = [np.minimum(alphas[i], alphas[min(i + 2, n - 1)]) for i in range(n)]

    # 3. keep the frames that change; the first kept frame is empty paper
    kept = [(0.0, np.zeros_like(alphas[0]))]
    for i, a in enumerate(alphas):
        if np.abs(a - kept[-1][1]).mean() > 0.0035 and a.max() > 0.3:
            kept.append((i / fps, a))
    # the last frame is the settled state, whatever the threshold decided
    if np.abs(alphas[-1] - kept[-1][1]).mean() > 0.001:
        kept.append(((len(alphas) - 1) / fps, alphas[-1]))
    t0 = kept[1][0]  # time of the first landing
    times = [0.0] + [round(t - t0 + 0.12, 3) for t, _ in kept[1:]]

    # 4. pigment: filmed under even light, wet ink is near-uniformly black;
    # dried on paper it isn't. One fixed mottle field (the same in every
    # frame, so nothing shimmers) thins the interior a little, and the edge
    # where the ink dried reads denser. Shapes are untouched.
    rng = np.random.default_rng(len(ev["name"]) * 97 + size)
    def smooth(sigma):
        n = np.asarray(Image.fromarray(((rng.standard_normal((size, size)) * 40) + 128).clip(0, 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32)
        return (n - n.mean()) / (n.std() + 1e-6)
    mottle = np.clip(0.9 + 0.07 * (smooth(size / 60) * 0.7 + smooth(size / 160) * 0.3), 0.76, 1)

    def blur(a, r):
        return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))) / 255.0

    def pigment(a):
        soft = blur(a, size / 140)
        rim = np.clip(a - soft, 0, 1) * 1.6
        a = np.clip(a * mottle + rim * 0.35, 0, 1) * (a > 0.02)
        if ev.get("soft"):
            # the ink has bled into the paper: a softened body inside a wide,
            # faint halo; the spray streaks dissolve into it
            a = np.clip(np.maximum(blur(a, size / 90) * 0.9, blur(a, size / 26) * 0.55), 0, 1)
        return a

    # 5. one strip, a whisper of softening on the edge so it sits on the page
    strip = Image.new("RGBA", (size * len(kept), size), (0, 0, 0, 0))
    for k, (_, a) in enumerate(kept):
        a = pigment(a)
        alpha = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
        frame = Image.new("RGBA", (size, size), CHARCOAL + (0,))
        frame.putalpha(alpha)
        strip.paste(frame, (k * size, 0))
    out = OUT / f"{ev['name']}.webp"
    strip.save(out, "WEBP", quality=82, method=6, alpha_quality=85)
    print(f"{out.name}: {len(kept)} frames @ {size}px, impact timeline {times}  {out.stat().st_size // 1024} KB")
    # how big the main body is within the frame, for sizing on the page
    lab, _ = label(alphas[-1] > 0.5)
    main = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    bys, bxs = np.where(main)
    body = round(max(np.ptp(bxs), np.ptp(bys)) / size, 3)
    return {"frames": len(kept), "size": size, "times": times, "body": body}


# ---------- the very large ink field ----------
#
# Not a drop. At the end of the "Splatters" clip several drops land and run
# together into one big pool that is cut off by the top and left edges of
# the shot - it literally enters the frame from a corner. Each growth state
# below is a real frame of that pool, keyed off the paper. On top of the
# real body, the ink is then let spread into the paper: a wet front that
# creeps outward following the pool's own shape (its blurred field, lightly
# perturbed so the edge is never smooth), with uneven pigment inside, a
# feathered fringe, and a faint dried tide line at the edge.

FIELD = {
    "clip": "pexels-6268211-padrinan.mp4",
    # real frames of the pool growing, first drops -> merged pool
    "times": [8.75, 8.85, 9.0, 9.15, 9.3, 9.55, 9.9, 10.3, 10.75],
    # source crop (px) - the shot's top-left, where the pool enters
    "crop": (0, 0, 1800, 1100),
    "width": 720,
}


def build_field():
    from scipy.ndimage import gaussian_filter  # noqa: PLC0415

    path = SRC / FIELD["clip"]
    cx, cy, cw, ch = FIELD["crop"]
    W = FIELD["width"]
    H = round(W * ch / cw)
    rng = np.random.default_rng(83)

    def noise(sigma):
        n = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), sigma)
        return n / (n.std() + 1e-6)

    def smoothstep(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)

    # fixed for all states, so growth never shimmers
    perturb = 0.07 * noise(W / 40) + 0.035 * noise(W / 120) + 0.015 * noise(W / 360)
    # pigment settles unevenly, in broad soft patches rather than blotches
    mottle = np.clip(0.78 + 0.2 * noise(W / 14) + 0.12 * noise(W / 40) + 0.04 * noise(W / 120), 0.3, 1)
    # the right and bottom of the crop must never show: ink thins out there.
    # The top and left stay dense - on the page they run off the screen edge
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    border = smoothstep(W * 0.99, W * 0.78, xx) * smoothstep(H * 0.99, H * 0.8, yy)

    states = []
    n = len(FIELD["times"])
    bodies = []
    for t in FIELD["times"]:
        frames, _ = grey_frames(path, t, t + 0.05, crop=FIELD["crop"], scale=None)
        lum = np.asarray(Image.fromarray(frames[0].astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32)
        bodies.append(key(lum))
    # only ink that stays put: the pool only ever grows, so anything not in
    # the next state too is a drop still in flight
    bodies = [np.minimum(bodies[i], bodies[min(i + 1, n - 1)]) for i in range(n)]
    for k in range(n):
        body = bodies[k]
        # only the pool and what lies close to it: far specks would bloom
        # into stray grey puffs
        lab, _ = label(body > 0.5)
        if lab.max():
            main = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
            near = gaussian_filter(main.astype(np.float32), W / 30) > 0.02
            body = body * near
        s = k / (n - 1)  # 0 -> 1 as it spreads

        # the wet front: the pool's blurred field, crossing a falling threshold
        field = gaussian_filter(body, W / 22) + perturb
        thr = 0.36 - 0.2 * s
        front = smoothstep(thr - 0.03, thr + 0.1, field)
        # where it has crept furthest it is thinnest
        reach = smoothstep(thr - 0.03, thr + 0.55, field)

        # the body: the real ink, bleeding a little more as it spreads
        core = gaussian_filter(body, W / 400 + s * W / 320)
        bleed = gaussian_filter(body, W / 70)

        tide = np.clip(front - gaussian_filter(front, W / 240), 0, 1)
        a = (front * (0.12 + 0.3 * reach) * mottle
             + np.maximum(core * 0.62, bleed * 0.32) * (0.55 + 0.45 * mottle)
             + tide * 0.45)
        states.append(np.clip(a * border, 0, 1))

    strip = Image.new("RGBA", (W * n, H), (0, 0, 0, 0))
    for k, a in enumerate(states):
        frame = Image.new("RGBA", (W, H), CHARCOAL + (0,))
        frame.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
        strip.paste(frame, (k * W, 0))
    dest = OUT / "ink-large.webp"
    # high alpha quality: the gradients are the whole effect, banding shows
    strip.save(dest, "WEBP", quality=60, method=6, alpha_quality=95)
    print(f"ink-large.webp: {n} states @ {W}x{H}  {dest.stat().st_size // 1024} KB")
    # real timings, first landing = 0, for the page to step through
    t0 = FIELD["times"][0]
    return {"frames": n, "width": W, "height": H, "times": [round(t - t0, 3) for t in FIELD["times"]]}


if __name__ == "__main__":
    only = sys.argv[2] if len(sys.argv) > 2 else None
    if only in (None, "drops"):
        manifest = {ev["name"]: build(ev) for ev in EVENTS}
        (OUT / "drops.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print("drops.json written")
    if only in (None, "large"):
        (OUT / "ink-large.json").write_text(json.dumps(build_field(), indent=2) + "\n")
        print("ink-large.json written")
