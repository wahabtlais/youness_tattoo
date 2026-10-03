import { useEffect } from 'react';
import { SHAPE_RATIO, workShape, type TattooWork } from '../../domain/work';
import { Dialog } from '../ui/Dialog';

interface WorkViewerProps {
  pieces: TattooWork[];
  /** index into pieces, or null when closed */
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
  /** "Ask Younes about a piece like this" - the seed of Find Similar */
  onAsk: (piece: TattooWork) => void;
}

/**
 * Focused view of one piece, in a modal Dialog. Arrow keys step through the
 * archive. This is the seam for the tattoo detail page (more images of the
 * same work, real details, related work) once that material exists.
 */
export function WorkViewer({ pieces, index, onChange, onClose, onAsk }: WorkViewerProps) {
  const piece = index === null ? null : pieces[index];

  useEffect(() => {
    if (index === null) return;
    const i = index;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') onChange((i + 1) % pieces.length);
      if (e.key === 'ArrowLeft') onChange((i - 1 + pieces.length) % pieces.length);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, pieces.length, onChange]);

  return (
    <Dialog open={piece !== null} onClose={onClose} labelledBy="workViewerTitle" className="workViewer">
      {piece && index !== null && (
        <div className="workViewer__inner">
          <figure className="workViewer__figure">
            <img
              key={piece.id}
              src={piece.image.src}
              width={piece.image.width}
              height={piece.image.height}
              alt={piece.alt}
              decoding="async"
            />
          </figure>

          <div className="workViewer__side">
            <p className="workViewer__num">
              {piece.id}
              <span> / {String(pieces.length).padStart(2, '0')}</span>
            </p>
            <h3 className="workViewer__title" id="workViewerTitle">
              {piece.title}
            </h3>
            <p className="workViewer__ratio">{SHAPE_RATIO[workShape(piece)]}</p>

            <button type="button" className="workViewer__ask unstyled" onClick={() => onAsk(piece)}>
              <span className="workViewer__askLine" aria-hidden="true" />
              Ask Younes about a piece like this
            </button>

            <div className="workViewer__nav">
              <button
                type="button"
                className="unstyled"
                onClick={() => onChange((index - 1 + pieces.length) % pieces.length)}
              >
                Prev
              </button>
              <button type="button" className="unstyled" onClick={() => onChange((index + 1) % pieces.length)}>
                Next
              </button>
            </div>
          </div>

          <button type="button" className="workViewer__close unstyled" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </Dialog>
  );
}
