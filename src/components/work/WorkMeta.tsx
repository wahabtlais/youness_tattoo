import { RATIO_LABEL, type WorkPiece } from '../../data/work';

/**
 * Contact-sheet caption: number, neutral label, native ratio. Always
 * visible - nothing about a piece is hover-only. The "View" cue is the only
 * part that waits for hover/focus.
 */
export function WorkMeta({ piece }: { piece: WorkPiece }) {
  return (
    <span className="workMeta">
      <span className="workMeta__num">{piece.id}</span>
      <span className="workMeta__rule" aria-hidden="true" />
      <span className="workMeta__label">{piece.label}</span>
      <span className="workMeta__ratio" aria-hidden="true">
        <span className="workMeta__ratioText">{RATIO_LABEL[piece.aspect]}</span>
        <span className="workMeta__view">View</span>
      </span>
    </span>
  );
}
