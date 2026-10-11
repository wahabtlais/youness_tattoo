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

/**
 * Copy shown until the studio supplies the real thing. Nothing about a
 * piece is invented: when `style`, `placement` or `description` exist on
 * the artwork they replace these.
 */
const PLACEHOLDER_META = 'Style and placement — to be added by the studio';
const PLACEHOLDER_STORY = 'The story behind this piece will come from Younes.';
/** the neutral title for a piece that has none */
const FALLBACK_TITLE = 'Tattoo study';
/** how many other prints the detail offers */
const MORE = 4;

interface WorkPhysicalDetailProps {
  pieces: TattooWork[];
  picked: PickedPrint | null;
  /** request to close: the archive animates the print back first */
  onClose: () => void;
  onFindSimilar: (piece: TattooWork) => void;
  /** open another print from the archive in place of this one */
  onOpenOther: (index: number) => void;
  paperRef: RefObject<HTMLDivElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  cloneRef: RefObject<HTMLSpanElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** the arm's WebGL canvas: above the flying print, always mounted so it is reused */
  armCanvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Detail image size: as large as the layout allows, in the print's own
 * proportions. Landscape screens set the print beside its text; portrait
 * screens (phones, upright tablets) stack them, the print sized from the
 * height so the text and Find similar stay close below it.
 */
function slotSize(p: PickedPrint) {
  const vw = innerWidth;
  const vh = innerHeight;
  const ratio = p.w / p.h;
  let w: number;
  if (vw > vh && vw >= 700) w = Math.min(vh * 0.74 * ratio, vw * 0.42);
  else w = Math.min(vw - 40, vh * (vw >= 700 ? 0.56 : 0.52) * ratio, 640);
  return { w, h: w / ratio, pad: p.border * (w / p.w) };
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The picked tattoo, laid out like a print on the table: the photograph
 * large on the left (top on mobile), and beside it its place in the
 * archive, title, what is known about it, the way into a consultation and
 * the next prints along the line. Opened and closed by the pick
 * choreography, which flies the very same print in and out of `slotRef`.
 *
 * Everything shown is real data or a marked placeholder (see above).
 * "More from the archive" is simply the next prints along the rope - not a
 * claim that they are similar.
 */
export function WorkPhysicalDetail({
  pieces,
  picked,
  onClose,
  onFindSimilar,
  onOpenOther,
  paperRef,
  slotRef,
  cloneRef,
  titleRef,
  armCanvasRef,
}: WorkPhysicalDetailProps) {
  const piece = picked ? pieces[picked.index] : null;
  const size = picked && slotSize(picked);
  const total = pieces.length;
  const meta = piece ? [piece.style, piece.placement].filter(Boolean).join(' / ') : '';
  const title = piece?.title || FALLBACK_TITLE;
  const more = picked
    ? Array.from({ length: Math.min(MORE, total - 1) }, (_, k) => (picked.index + 1 + k) % total)
    : [];

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
        <div
          // the layout covers the dialog: a click on its empty paper closes, like the dialog's own surface
          onClick={(e) => e.target === e.currentTarget && onClose()}
          className="relative grid min-h-full content-center justify-center gap-8 px-page-x pt-16 pb-12 tablet:landscape:grid-flow-col tablet:landscape:items-end tablet:landscape:gap-[clamp(2rem,5vw,5rem)]"
        >
          <div
            ref={slotRef}
            className="pa-print invisible justify-self-center opacity-0"
            style={{ position: 'relative', width: size.w, height: size.h, '--border': `${size.pad}px`, '--ss': size.w / picked.w } as CSSProperties}
          >
            <ResponsiveImage
              image={piece.image}
              alt={piece.alt}
              priority
              sizes={`${Math.round(size.w)}px`}
              className="block size-full object-cover"
            />
          </div>

          <div className="flex max-w-88 flex-col gap-3 pb-1 max-tablet:justify-self-stretch">
            <p data-detail-text className="type-eyebrow text-burgundy">
              / {two(picked.index + 1)} <span className="text-ink-muted">of {two(total)}</span>
            </p>
            <h2
              data-detail-text
              id="paDetailTitle"
              ref={titleRef}
              tabIndex={-1}
              className="type-heading text-headline outline-none"
            >
              {title}
            </h2>
            <p data-detail-text className="type-meta text-ink-muted">
              {meta || PLACEHOLDER_META}
            </p>
            <p
              data-detail-text
              className={`mt-2 font-serif text-lede italic ${piece.description ? 'text-ink-soft' : 'text-ink-muted'}`}
            >
              {piece.description ?? PLACEHOLDER_STORY}
            </p>
            <div data-detail-text className="mt-6">
              <Button onClick={() => onFindSimilar(piece)}>Find similar &rarr;</Button>
            </div>

            {more.length > 0 && (
              <nav data-detail-text aria-label="More from the archive" className="mt-8 border-t border-rule pt-5">
                <p className="mb-3 type-meta text-ink-muted">More from the archive</p>
                <ul className="flex gap-3">
                  {more.map((i) => {
                    const other = pieces[i];
                    return (
                      <li key={other.id}>
                        <button
                          type="button"
                          onClick={() => onOpenOther(i)}
                          aria-label={`Open ${other.title || FALLBACK_TITLE} ${two(i + 1)}`}
                          className="pa-thumb group block"
                        >
                          <span className="pa-thumb__print">
                            <ResponsiveImage
                              image={other.image}
                              alt=""
                              sizes="64px"
                              ratio="4 / 5"
                              className="pa-thumb__img"
                            />
                          </span>
                          <span className="mt-1.5 block type-meta text-ink-muted transition-colors group-hover:text-burgundy group-focus-visible:text-burgundy">
                            {two(i + 1)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
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
            {/* the deeper shadow of a print held off the paper: its own layer,
                so it fades by opacity (compositor) instead of repainting */}
            <span data-lift className="pa-lift" />
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
