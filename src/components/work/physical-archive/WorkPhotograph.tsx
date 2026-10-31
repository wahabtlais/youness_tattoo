import type { TattooWork } from '../../../domain/work';
import { ResponsiveImage } from '../../ui/ResponsiveImage';

interface WorkPhotographProps {
  piece: TattooWork;
  index: number;
  total: number;
  onPick: (index: number) => void;
  onHover: (index: number | null) => void;
  onFocus: (index: number) => void;
}

/**
 * One photograph hanging from the rope. Three nested layers, each owned by
 * one motion source so they never fight:
 *   [data-hang]   position on the rope + swing   (useArchiveMotion, rAF)
 *   button        the touch: lift, shadow        (CSS hover / focus)
 *   [data-print]  the pick: recede, lift, hide    (pickTimeline, GSAP)
 * The clip stays on the rope when the print is taken.
 */
export function WorkPhotograph({ piece, index, total, onPick, onHover, onFocus }: WorkPhotographProps) {
  return (
    <div data-hang className="pa-hang absolute top-0 left-0 origin-top will-change-transform">
      <span className="pa-clip" aria-hidden="true" />
      <span className="pa-wire" aria-hidden="true" />
      <button
        type="button"
        className="pa-photo"
        aria-label={`${piece.title} ${piece.id}, ${index + 1} of ${total}. Take it down to look closer.`}
        onClick={() => onPick(index)}
        onPointerEnter={(e) => {
          delete e.currentTarget.dataset.returned;
          if (e.pointerType === 'mouse') onHover(index);
        }}
        onPointerLeave={(e) => {
          delete e.currentTarget.dataset.returned;
          onHover(null);
        }}
        onFocus={(e) => {
          const from = e.relatedTarget as Element | null;
          // focus handed back by the closing detail: the print has just been
          // re-hung (and marked so by the return), it shows its ring but
          // doesn't lift again
          if (from?.closest('dialog')) return;
          // keyboard browsing only holds the archive
          if (e.currentTarget.matches(':focus-visible')) onFocus(index);
        }}
        onBlur={(e) => {
          delete e.currentTarget.dataset.returned;
          onHover(null);
        }}
      >
        <span data-print className="pa-print">
          <ResponsiveImage
            image={piece.image}
            alt={piece.alt}
            sizes="(max-width: 699px) 40vw, 260px"
            draggable={false}
            className="block size-full object-cover"
          />
        </span>
      </button>
    </div>
  );
}
