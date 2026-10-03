import { workShape, type TattooWork } from '../../../domain/work';

/**
 * The archive's art direction in numbers. Each photograph gets a controlled
 * variation (size, rest angle, how far below the rope it hangs, the gap
 * after it) from these short cycles, so the line feels hung by hand but
 * still designed. Everything scales with the stage width.
 */
const SCALE = [1, 0.86, 0.95, 1.08, 0.9, 0.82, 1.03, 0.92];
const ANGLE = [-2.2, 1.6, -0.8, 2.4, -1.4, 0.9, -2.8, 1.2];
const HANG = [0, 30, 8, 52, 14, 0, 38, 10];
const GAP = [0, 18, -10, 24, 0, -14, 10, 0];

/** print width at unit scale, by the photograph's shape */
const BASE_WIDTH = { square: 212, portrait: 206, tall: 158 } as const;

export interface PrintLayout {
  /** print size including its paper border */
  w: number;
  h: number;
  /** centre along the track, before the archive moves */
  x: number;
  /** rest angle, degrees */
  angle: number;
  /** wire length between rope clip and print */
  hang: number;
}

export interface ArchiveLayout {
  unit: number;
  mobile: boolean;
  prints: PrintLayout[];
  /** length of one full lap of the archive */
  track: number;
  /** rope centre line at its highest point, and its sag */
  ropeY: number;
  sag: number;
  /** drawn rope thickness */
  rope: number;
  /** paper border width */
  border: number;
  stageHeight: number;
  /** ambient drift, px/s (negative: right to left) */
  drift: number;
}

export function layoutArchive(pieces: TattooWork[], stageWidth: number): ArchiveLayout {
  const mobile = stageWidth < 700;
  const unit = mobile ? Math.min(0.7, stageWidth / 560) : Math.min(1.25, Math.max(0.8, stageWidth / 1440));
  const border = Math.round((mobile ? 6 : 9) * Math.max(unit, 0.8));

  let cursor = 0;
  const prints = pieces.map((piece, i) => {
    const k = i % SCALE.length;
    const inner = BASE_WIDTH[workShape(piece)] * SCALE[k] * unit;
    const w = Math.round(inner + border * 2);
    const h = Math.round((inner * piece.image.height) / piece.image.width + border * 2);
    const gap = (mobile ? 34 : 70) * unit + GAP[k] * unit;
    const x = cursor + w / 2;
    cursor += w + gap;
    return { w, h, x, angle: ANGLE[k], hang: HANG[k] * unit };
  });

  // one lap must be longer than the screen plus a print either side, or a
  // print would visibly jump from one edge to the other
  const widest = Math.max(...prints.map((p) => p.w));
  const minTrack = stageWidth + widest * 2.2;
  const stretch = cursor < minTrack ? minTrack / cursor : 1;
  for (const p of prints) p.x *= stretch;

  const ropeY = (mobile ? 46 : 74) * Math.max(unit, 0.85);
  const sag = (mobile ? 18 : 34) * unit;
  const lowest = Math.max(...prints.map((p) => p.h + p.hang));
  return {
    unit,
    mobile,
    prints,
    track: cursor * stretch,
    ropeY,
    sag,
    rope: (mobile ? 18 : 28) * Math.max(unit, 0.8),
    border,
    stageHeight: Math.round(ropeY + sag + 22 * unit + lowest + (mobile ? 40 : 70)),
    drift: mobile ? -9 : -14,
  };
}
