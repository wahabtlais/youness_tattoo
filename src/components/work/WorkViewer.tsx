import { useEffect, useRef } from 'react';
import { RATIO_LABEL, workAlt, workLargest, type WorkPiece } from '../../data/work';

interface WorkViewerProps {
  pieces: WorkPiece[];
  /** index into pieces, or null when closed */
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
  /** "Ask Younes about a piece like this" */
  onAsk: () => void;
}

/**
 * Focused view of one piece. A native modal <dialog>: focus containment,
 * Escape and focus return come from the platform. Arrow keys step through
 * the archive. This is the seam for the fuller viewer (more images of the
 * same work, real details) once that material exists.
 */
export function WorkViewer({ pieces, index, onChange, onClose, onAsk }: WorkViewerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const piece = index === null ? null : pieces[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (piece && !dialog.open) dialog.showModal();
    if (!piece && dialog.open) dialog.close();
  }, [piece]);

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
    <dialog
      className="workViewer"
      ref={ref}
      aria-labelledby="workViewerTitle"
      onClose={onClose}
      onClick={(e) => {
        // a click on the backdrop (the dialog box itself, not its content)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {piece && index !== null && (
        <div className="workViewer__inner">
          <figure className="workViewer__figure">
            <img
              key={piece.id}
              src={workLargest(piece)}
              width={piece.width}
              height={piece.height}
              alt={workAlt(piece)}
              decoding="async"
            />
          </figure>

          <div className="workViewer__side">
            <p className="workViewer__num">
              {piece.id}
              <span> / {String(pieces.length).padStart(2, '0')}</span>
            </p>
            <h3 className="workViewer__title" id="workViewerTitle">
              {piece.label}
            </h3>
            <p className="workViewer__ratio">{RATIO_LABEL[piece.aspect]}</p>

            <button type="button" className="workViewer__ask unstyled" onClick={onAsk}>
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
    </dialog>
  );
}
