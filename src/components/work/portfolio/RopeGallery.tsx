import { useState, type CSSProperties } from 'react';
import { traitLabel, verifiedFacts, type TattooWork } from '../../../domain/work';
import { useRopeCount } from '../../../hooks/useRopeCount';
import { cx } from '../../../lib/cx';
import '../physical-archive/physicalArchive.css';
import './ropeGallery.css';

interface RopeGalleryProps {
  /** this page's pieces, in order */
  pieces: TattooWork[];
  /** how many pieces the portfolio has in all (for "of 08") */
  total: number;
  onOpen: (piece: TattooWork) => void;
}

/**
 * How each print hangs, by rope (lane) and its place down that rope. A
 * composed table, not chance: widths, sideways shifts, resting angles and
 * the drop to each print differ from rope to rope and row to row, so the
 * three columns never read as a grid, yet every page hangs the same way.
 * Widths are shares of the lane; the photograph inside keeps its own shape.
 */
const HANG: { w: number; x: number; r: number; drop: number }[][] = [
  [
    { w: 0.84, x: -3, r: -1.1, drop: 44 },
    { w: 0.7, x: 5, r: 0.8, drop: 70 },
    { w: 0.8, x: -2, r: -0.5, drop: 58 },
  ],
  [
    { w: 0.72, x: 4, r: 0.9, drop: 120 },
    { w: 0.86, x: -4, r: -0.7, drop: 62 },
    { w: 0.7, x: 3, r: 1.1, drop: 74 },
  ],
  [
    { w: 0.8, x: -4, r: -0.6, drop: 76 },
    { w: 0.72, x: 3, r: 1.2, drop: 66 },
    { w: 0.88, x: -3, r: -0.9, drop: 54 },
  ],
];
/** one rope (phones): wider prints, swinging from side to side of the cord */
const SINGLE = [
  { w: 0.82, x: -7, r: -1, drop: 40 },
  { w: 0.74, x: 8, r: 0.9, drop: 56 },
  { w: 0.86, x: -5, r: -0.6, drop: 56 },
  { w: 0.72, x: 7, r: 1.1, drop: 56 },
];

const two = (n: number | string) => String(n).padStart(2, '0');

/**
 * The portfolio as a hanging archive: a rail across the page and ropes
 * dropping from it - three, two or one, by width (useRopeCount) - each
 * carrying its prints in reading order across the ropes (piece 1 on the
 * first rope, 2 on the second…), so every rope is used. A real rope (the
 * home archive's own rope photograph, turned upright) and the home archive's
 * own print paper, so the two read as one studio. No hardware: each print
 * hangs straight from its rope, the photograph and its caption on one mount.
 *
 * Arriving - once per page - the rail draws, the ropes drop and the prints
 * settle in a short stagger; afterwards nothing moves until a pointer or
 * keyboard reaches a print (it straightens and lifts a hair). All of it is CSS, none of it under reduced motion, and the prints
 * are clickable from the first frame.
 */
export function RopeGallery({ pieces, total, onOpen }: RopeGalleryProps) {
  const fits = useRopeCount();
  // only as many ropes as there are prints to hang (a page of two hangs on
  // two): pieces go across the ropes in order, so none is ever left bare
  const ropes = Math.max(1, Math.min(fits, pieces.length));
  const lanes: TattooWork[][] = Array.from({ length: ropes }, () => []);
  pieces.forEach((p, i) => lanes[i % ropes].push(p));
  // fewer ropes keep the width they have when all hang - centred under the
  // rail - so the prints don't grow and the page doesn't jump
  const span = `calc((100% - ${fits - 1} * var(--rg-gap)) * ${ropes / fits} + ${ropes - 1} * var(--rg-gap))`;

  return (
    <div className="rg-arrive relative">
      {/* the rail the ropes hang from, with a mark where each is tied */}
      <div aria-hidden="true" className="rg-rail relative h-px bg-ink/45">
        <span className="absolute -top-[3px] left-0 h-[7px] w-px bg-ink/60" />
        <span className="absolute -top-[3px] right-0 h-[7px] w-px bg-ink/60" />
      </div>
      <div
        className="mx-auto grid gap-x-(--rg-gap) [--rg-gap:clamp(1rem,2.4vw,2.5rem)]"
        style={{ gridTemplateColumns: `repeat(${ropes}, minmax(0, 1fr))`, width: ropes < fits ? span : undefined }}
      >
        {lanes.map((lane, l) => (
          <ul key={l} className="relative self-start pb-[clamp(3rem,7vh,4.5rem)]" style={{ '--lane': l } as CSSProperties}>
            <span aria-hidden="true" className="rg-rope" />
            <span aria-hidden="true" className="rg-knot" />
            {lane.map((piece, row) => {
              const h = fits === 1 ? SINGLE[row % SINGLE.length] : HANG[l % 3][row % 3];
              return (
                <li key={piece.id} style={{ paddingTop: `clamp(${Math.round(h.drop * 0.6)}px, ${(h.drop / 14).toFixed(2)}vw, ${h.drop}px)` }}>
                  <Print piece={piece} total={total} hang={h} order={row * ropes + l} onOpen={() => onOpen(piece)} />
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}

function Print({
  piece,
  total,
  hang,
  order,
  onOpen,
}: {
  piece: TattooWork;
  total: number;
  hang: { w: number; x: number; r: number };
  order: number;
  onOpen: () => void;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const { meta } = verifiedFacts(piece);
  const sampleWords =
    piece.metadataStatus === 'demo' ? [...(piece.style ?? []), piece.placement].filter(Boolean).map((v) => traitLabel(v!)).join(' · ') : '';
  const largest = piece.image.variants.at(-1);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${piece.title} ${piece.id} of ${two(total)}`}
      className="rg-print group"
      style={{ '--w': `${hang.w * 100}%`, '--x': `${hang.x}%`, '--r': `${hang.r}deg`, '--order': order } as CSSProperties}
    >
      <span className="rg-print__hang">
        {/* one archival object: the photograph and its caption on the same paper mount */}
        <span className="pa-print" style={{ '--border': 'clamp(5px, 0.7vw, 9px)' } as CSSProperties}>
          {/* the photograph at its own proportions; tinted paper shows until it has arrived */}
          <span className="relative block bg-paper-deep" style={{ aspectRatio: `${piece.image.width} / ${piece.image.height}` }}>
            {state !== 'failed' ? (
              <img
                src={largest?.src ?? piece.image.src}
                srcSet={piece.image.variants.map((v) => `${v.src} ${v.width}w`).join(', ') || undefined}
                sizes="(min-width: 1000px) 27vw, (min-width: 560px) 42vw, 80vw"
                width={piece.image.width}
                height={piece.image.height}
                alt={piece.alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setState('loaded')}
                onError={() => setState('failed')}
                className={cx(
                  'absolute inset-0 block size-full object-contain transition-opacity duration-(--duration-slow) ease-editorial motion-reduce:transition-none',
                  state === 'loaded' ? 'opacity-100' : 'opacity-0',
                )}
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-paper-deep p-4 text-center type-meta leading-normal text-ink-soft">
                Photograph unavailable
              </span>
            )}
          </span>
          {/* the mount's caption: number and title, what is known, the cue */}
          <span className="rg-caption relative block px-[0.15rem] pt-[clamp(0.55rem,0.9vw,0.8rem)] pb-[0.1rem]">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 type-meta text-burgundy">/ {piece.id}</span>
              <span className="truncate font-serif text-lede leading-tight text-ink">{piece.title}</span>
            </span>
            {meta && <span className="mt-1 block type-meta leading-normal text-ink-soft">{meta}</span>}
            {sampleWords && <span className="mt-1 block type-meta leading-normal text-ink-soft">Sample: {sampleWords}</span>}
            <span
              aria-hidden="true"
              className="mt-2 flex items-center gap-2 border-t border-rule pt-1.5 type-label text-ink-soft transition-colors group-hover:text-burgundy group-focus-visible:text-burgundy"
            >
              <span className="underline decoration-burgundy/0 underline-offset-[5px] transition-[text-decoration-color] group-hover:decoration-burgundy group-focus-visible:decoration-burgundy">
                View piece
              </span>
              <span className="transition-transform duration-(--duration-fast) group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                &rarr;
              </span>
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
