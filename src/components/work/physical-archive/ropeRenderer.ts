/**
 * Draws the real rope photograph (src/assets/work/rope.png) as a hanging,
 * moving rope. The source is a straight strip, so it is drawn in thin
 * vertical slices, each dropped onto the rope's curve - the strands keep
 * their photographed texture while the rope sags, dips and recoils.
 *
 * The strip is made seamless once (its last stretch cross-faded over its
 * first) so it can travel forever, and a soft shadow copy is pre-rendered
 * so the per-frame work is only drawImage calls.
 */

/** the rope's band inside rope.png (measured: rope occupies y 216-284) */
const SRC_TOP = 204;
const SRC_HEIGHT = 92;
const ROPE_IN_BAND = 68;
const OVERLAP = 120;
const SLICE = 5;

export interface RopeTiles {
  rope: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  width: number;
}

export function buildRopeTiles(img: HTMLImageElement): RopeTiles {
  const width = img.naturalWidth - OVERLAP;
  const rope = document.createElement('canvas');
  rope.width = width;
  rope.height = SRC_HEIGHT;
  const ctx = rope.getContext('2d')!;
  ctx.drawImage(img, 0, SRC_TOP, width, SRC_HEIGHT, 0, 0, width, SRC_HEIGHT);

  // the strip's tail, faded in over its head, hides the seam
  const tail = document.createElement('canvas');
  tail.width = OVERLAP;
  tail.height = SRC_HEIGHT;
  const tctx = tail.getContext('2d')!;
  tctx.drawImage(img, width, SRC_TOP, OVERLAP, SRC_HEIGHT, 0, 0, OVERLAP, SRC_HEIGHT);
  tctx.globalCompositeOperation = 'destination-in';
  const fade = tctx.createLinearGradient(0, 0, OVERLAP, 0);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = fade;
  tctx.fillRect(0, 0, OVERLAP, SRC_HEIGHT);
  ctx.globalCompositeOperation = 'destination-out';
  const hole = ctx.createLinearGradient(0, 0, OVERLAP, 0);
  hole.addColorStop(0, 'rgba(0,0,0,1)');
  hole.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hole;
  ctx.fillRect(0, 0, OVERLAP, SRC_HEIGHT);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(tail, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // the rope's shadow on the paper: its own silhouette, inked and softened
  const shadow = document.createElement('canvas');
  shadow.width = width;
  shadow.height = SRC_HEIGHT;
  const sctx = shadow.getContext('2d')!;
  sctx.filter = 'blur(5px)';
  sctx.drawImage(rope, 0, 0);
  sctx.filter = 'none';
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = 'rgba(20, 19, 26, 0.16)';
  sctx.fillRect(0, 0, width, SRC_HEIGHT);

  return { rope, shadow, width };
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * @param offset how far the archive has travelled (px, screen space)
 * @param curveY the rope's centre line at a screen x
 * @param thickness drawn rope thickness (px)
 */
export function drawRope(
  ctx: CanvasRenderingContext2D,
  tiles: RopeTiles,
  stageWidth: number,
  offset: number,
  curveY: (x: number) => number,
  thickness: number,
) {
  const scale = thickness / ROPE_IN_BAND;
  const h = SRC_HEIGHT * scale;
  const srcSlice = SLICE / scale;
  for (const [tile, dy] of [
    [tiles.shadow, thickness * 0.55],
    [tiles.rope, 0],
  ] as const) {
    // whole-pixel slices that exactly abut: no gaps, and no overlap (which
    // would double the alpha of the soft edges into stripes)
    for (let x = -SLICE; x < stageWidth + SLICE; x += SLICE) {
      const sx = mod((x - offset) / scale, tiles.width);
      const sw = Math.min(srcSlice, tiles.width - sx);
      const y = curveY(x + SLICE / 2) - h / 2 + dy;
      const dw = Math.round(sw * scale);
      ctx.drawImage(tile, sx, 0, sw, SRC_HEIGHT, x, y, dw, h);
      if (dw < SLICE) ctx.drawImage(tile, 0, 0, srcSlice - sw, SRC_HEIGHT, x + dw, y, SLICE - dw, h);
    }
  }
}
