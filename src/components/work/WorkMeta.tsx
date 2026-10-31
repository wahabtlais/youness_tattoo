import { SHAPE_RATIO, workShape, type TattooWork } from '../../domain/work';

/**
 * Contact-sheet caption: number, neutral label, native ratio. Always
 * visible - nothing about a piece is hover-only. The "View" cue is the only
 * part that waits for hover/focus.
 */
export function WorkMeta({ piece }: { piece: TattooWork }) {
  return (
    <span className="workMeta">
      <span className="workMeta__num">{piece.id}</span>
      <span className="workMeta__rule" aria-hidden="true" />
      <span className="workMeta__label">{piece.title}</span>
      <span className="workMeta__ratio" aria-hidden="true">
        <span className="workMeta__ratioText">{SHAPE_RATIO[workShape(piece)]}</span>
        <span className="workMeta__view">View</span>
      </span>
    </span>
  );
}
