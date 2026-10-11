import { workShape, type TattooWork } from '../../../../domain/work';

/**
 * Version B's composition in numbers: one rope across the top, the selected
 * print hanging large at its lowest point, the other prints smaller along
 * it. Pure - the same order and screen always give the same layout, so the
 * swap can animate from one layout to the next without measuring the DOM.
 */

/** a print's size as it hangs in the archive: everything here scales from it */
export interface PrintSize {
  w: number;
  h: number;
  border: number;
}

export interface PlacedPrint {
  /** centre x and top of the print, its size and rest angle (content px) */
  cx: number;
  top: number;
  w: number;
  h: number;
  angle: number;
  /** where its clip sits on the rope, and the wire between clip and print */
  clipY: number;
  hang: number;
}

export interface Rope {
  /** the rope's centre line at its highest point, and its sag */
  y: number;
  sag: number;
  centre: number;
  span: number;
  thickness: number;
  canvasHeight: number;
}

export interface DetailLayout {
  /** the rope row - wider than the screen when it has to scroll */
  width: number;
  height: number;
  /** by place along the rope; places[main] is the large print */
  places: PlacedPrint[];
  main: number;
  /** top of the large print, and its height for any piece */
  mainTop: number;
  mainHeight: (piece: number) => number;
  /** gap between the large print and its details */
  textGap: number;
  rope: Rope;
}

/** each piece's own size and tilt as a small print - it keeps them wherever it hangs */
const SCALE = [1, 0.9, 0.96, 1.06, 0.92, 0.86, 1.02, 0.94];
const ANGLE = [-1.8, 1.4, -0.7, 2.1, -1.3, 0.8, -2.3, 1.1];
/** wire length under each clip, by place along the rope */
const HANG = [10, 30, 4, 22, 0, 26, 6, 34, 14, 2];
/** small print width at unit scale, by the photograph's shape */
const SMALL = { square: 128, portrait: 124, tall: 96 } as const;
/** matches .pa-hang's --clip-h */
export const CLIP_H = 18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** the large print's place: the middle of the line */
export const mainPlace = (n: number) => Math.floor((n - 1) / 2);

/** opened on a piece: it hangs in the middle, the archive's order runs on either side */
export function initialOrder(n: number, selected: number) {
  const m = mainPlace(n);
  return Array.from({ length: n }, (_, k) => mod(selected + k - m, n));
}

export const ropeCurve = (r: Rope) => (x: number) => {
  const u = clamp((x - r.centre) / r.span, -1.25, 1.25);
  return r.y + r.sag * (1 - u * u);
};

/**
 * @param sizes each piece's archive print size (the large print's shadow and
 *   border scale from it, so it matches the flying copy exactly)
 * @param order piece index at each place along the rope
 */
export function layoutDetail(
  pieces: TattooWork[],
  sizes: PrintSize[],
  order: number[],
  vw: number,
  vh: number,
): DetailLayout {
  const n = order.length;
  const m = mainPlace(n);
  const mobile = vw < 700;
  const portrait = vh > vw;
  const k = clamp(vw / 1440, 0.8, 1.25);

  const thickness = mobile ? 16 : Math.round(24 * k);
  const ropeY = mobile ? 62 : clamp(vh * 0.09, 66, 104);
  const sag = mobile ? 12 : 22 * k;
  const mainHang = mobile ? 8 : 12;
  const mainTop = ropeY + sag - thickness * 0.3 + CLIP_H + mainHang;

  // the large print: as big as the screen allows with its details below
  const textRoom = mobile ? 210 : 214;
  const maxH = Math.max(mobile ? 240 : 300, Math.min(vh * (mobile ? 0.5 : 0.62), vh - mainTop - textRoom - 24));
  const maxW = vw * (mobile ? 0.72 : portrait ? 0.56 : 0.36);
  const ratio = (i: number) => sizes[i].w / sizes[i].h;
  const mainW = (i: number) => Math.min(maxH * ratio(i), maxW);
  const mainHeight = (i: number) => mainW(i) / ratio(i);

  // the small prints: as large as fits across the screen whichever piece is
  // in the middle (so they keep their size through a swap), never smaller
  // than a comfortable target; below that the rope scrolls
  const smallAt1 = (i: number) => SMALL[workShape(pieces[i])] * SCALE[i % SCALE.length];
  const gapMain = mobile ? 22 : 52 * k;
  const gapUnit = mobile ? 18 : 34;
  const margin = mobile ? 16 : 44 * k;
  const all = pieces.reduce((s, _, i) => s + smallAt1(i), 0);
  let su = Infinity;
  for (let i = 0; i < n; i++) {
    const room = vw - 2 * margin - mainW(i) - 2 * gapMain;
    su = Math.min(su, room / (all - smallAt1(i) + (n - 3) * gapUnit));
  }
  su = clamp(su, mobile ? 0.56 : 0.6, 1);
  const smallW = (i: number) => smallAt1(i) * su;
  const gap = gapUnit * su;
  let needed = 0;
  for (let i = 0; i < n; i++) needed = Math.max(needed, mainW(i) + 2 * gapMain + (all - smallAt1(i)) * su + (n - 3) * gap);
  const width = Math.max(vw, Math.ceil(needed + 2 * margin));
  const centre = width / 2;

  const rope: Rope = {
    y: ropeY,
    sag,
    centre,
    span: width * (mobile ? 0.6 : 0.56),
    thickness,
    canvasHeight: Math.ceil(ropeY + sag + thickness * 1.4 + 6),
  };
  const curve = ropeCurve(rope);

  const place = (at: number, piece: number, cx: number, w: number): PlacedPrint => {
    const clipY = curve(cx) - thickness * 0.3;
    const hang = at === m ? mainHang : HANG[at % HANG.length] * (mobile ? 0.6 : k);
    return {
      cx,
      top: clipY + CLIP_H + hang,
      w,
      h: w / ratio(piece),
      angle: at === m ? 0 : ANGLE[piece % ANGLE.length],
      clipY,
      hang,
    };
  };

  const places: PlacedPrint[] = new Array(n);
  const big = mainW(order[m]);
  places[m] = place(m, order[m], centre, big);
  let x = centre - big / 2 - gapMain;
  for (let at = m - 1; at >= 0; at--) {
    const w = smallW(order[at]);
    places[at] = place(at, order[at], x - w / 2, w);
    x -= w + gap;
  }
  x = centre + big / 2 + gapMain;
  for (let at = m + 1; at < n; at++) {
    const w = smallW(order[at]);
    places[at] = place(at, order[at], x + w / 2, w);
    x += w + gap;
  }

  // the large print's shadow reaches ~34px below it at archive size, and
  // scales with it (--ss): the row must hold it, or its edge shows
  let tallest = 0;
  let shadow = 0;
  for (let i = 0; i < n; i++) {
    tallest = Math.max(tallest, mainHeight(i));
    shadow = Math.max(shadow, 34 * (mainW(i) / sizes[i].w));
  }

  return {
    width,
    // room for the tallest large print and its shadow, so a swap never
    // changes the row's height
    height: Math.ceil(mainTop + tallest + shadow + 8),
    places,
    main: m,
    mainTop,
    mainHeight,
    textGap: mobile ? 22 : 30,
    rope,
  };
}
