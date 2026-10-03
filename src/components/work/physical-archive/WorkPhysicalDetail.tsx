import type { CSSProperties, RefObject } from 'react';
import type { TattooWork } from '../../../domain/work';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ResponsiveImage } from '../../ui/ResponsiveImage';

/** the picked print's proportions, measured on the rope */
export interface PickedPrint {
  index: number;
  w: number;
  h: number;
  border: number;
  /** the exact image the rope was showing, so the flight never reloads */
  src: string;
}

interface WorkPhysicalDetailProps {
  piece: TattooWork | null;
  picked: PickedPrint | null;
  total: number;
  /** request to close: the archive animates the print back first */
  onClose: () => void;
  onFindSimilar: (piece: TattooWork) => void;
  paperRef: RefObject<HTMLDivElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  cloneRef: RefObject<HTMLSpanElement | null>;
  textRef: RefObject<HTMLDivElement | null>;
  /** the arm's WebGL canvas: above the flying print, always mounted so it is reused */
  armCanvasRef: RefObject<HTMLCanvasElement | null>;
}

/** detail image size: as large as the layout allows, in the print's own proportions */
function slotSize(p: PickedPrint) {
  const vw = innerWidth;
  const vh = innerHeight;
  const ratio = p.w / p.h;
  let w: number;
  if (vw >= 900) w = Math.min(vh * 0.74 * ratio, vw * 0.42);
  else w = Math.min(vw - 40, vh * 0.52 * ratio);
  return { w, h: w / ratio, pad: p.border * (w / p.w) };
}

/**
 * The picked tattoo, laid out like a print on the table: the photograph
 * large on the left (top on mobile), its plate number, title and the way
 * into the consultation on the right. Opened and closed by the pick
 * choreography, which flies the very same print in and out of `slotRef`.
 *
 * Copy: only real data. Title is the archive's neutral label; style,
 * placement and the story are not supplied yet and are marked as such.
 */
export function WorkPhysicalDetail({
  piece,
  picked,
  total,
  onClose,
  onFindSimilar,
  paperRef,
  slotRef,
  cloneRef,
  textRef,
  armCanvasRef,
}: WorkPhysicalDetailProps) {
  const size = picked && slotSize(picked);
  const meta = piece && [piece.style, piece.placement].filter(Boolean).join(' / ');

  return (
    <Dialog
      open={picked !== null}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      labelledBy="paDetailTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-x-hidden overflow-y-auto bg-transparent p-0 backdrop:bg-transparent"
    >
      <div ref={paperRef} className="pointer-events-none fixed inset-0 bg-paper opacity-0" aria-hidden="true" />
      <canvas ref={armCanvasRef} className="pointer-events-none fixed inset-0 z-3 size-full" aria-hidden="true" />

      {piece && picked && size && (
        <div className="relative grid min-h-full content-center justify-center gap-8 px-page-x pt-16 pb-12 tablet:grid-flow-col tablet:items-end tablet:gap-[clamp(2rem,5vw,5rem)]">
          <div
            ref={slotRef}
            className="pa-print invisible justify-self-center opacity-0"
            style={{ position: 'relative', width: size.w, height: size.h, '--border': `${size.pad}px` } as CSSProperties}
          >
            <ResponsiveImage
              image={piece.image}
              alt={piece.alt}
              priority
              sizes={`${Math.round(size.w)}px`}
              className="block size-full object-cover"
            />
          </div>

          <div ref={textRef} className="flex max-w-[22rem] flex-col gap-3 pb-1">
            <p data-detail-text className="type-eyebrow text-burgundy">
              / {piece.id} <span className="text-ink-muted">of {String(total).padStart(2, '0')}</span>
            </p>
            <h2 data-detail-text id="paDetailTitle" className="type-heading text-headline">
              {piece.title}
            </h2>
            <p data-detail-text className="type-meta text-ink-muted">
              {meta || 'Style and placement - to be added by the studio'}
            </p>
            <p data-detail-text className="mt-2 font-serif text-lede text-ink-soft italic">
              {piece.description ?? 'The story behind this piece will come from Younes.'}
            </p>
            <div data-detail-text className="mt-6">
              <Button onClick={() => onFindSimilar(piece)}>Find similar &rarr;</Button>
            </div>
          </div>
        </div>
      )}

      {piece && picked && (
        <>
          {/* the print in flight: the same photograph that left the rope */}
          <span
            ref={cloneRef}
            className="pa-print pointer-events-none invisible z-2 opacity-0"
            style={{ position: 'absolute', '--border': `${picked.border}px` } as CSSProperties}
            aria-hidden="true"
          >
            <img src={picked.src} alt="" className="block size-full object-cover" draggable={false} />
          </span>
          <Button
            data-detail-text
            variant="text"
            className="fixed top-[calc(var(--spacing-page-y)+0.4rem)] right-page-x z-10"
            onClick={onClose}
          >
            Close &times;
          </Button>
        </>
      )}
    </Dialog>
  );
}
