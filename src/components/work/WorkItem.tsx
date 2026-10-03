import type { CSSProperties } from 'react';
import { useInView } from '../../hooks/useInView';
import { workAlt, workSrcSet, type WorkPiece } from '../../data/work';
import { WorkMeta } from './WorkMeta';

interface WorkItemProps {
  piece: WorkPiece;
  /** placement slot in the gallery composition (1-based) */
  slot: number;
  sizes: string;
  onOpen: (piece: WorkPiece) => void;
}

/**
 * One pinned print: the photograph at its native ratio inside crop marks,
 * with its caption underneath. The frame reserves the exact aspect ratio up
 * front, so lazy loading never shifts the layout.
 */
export function WorkItem({ piece, slot, sizes, onOpen }: WorkItemProps) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.12 });

  return (
    <figure
      className={`workItem workItem--${slot} workItem--${piece.aspect}`}
      ref={ref}
      data-in={inView}
      style={{ '--ar': `${piece.width} / ${piece.height}` } as CSSProperties}
    >
      <button
        type="button"
        className="workItem__open unstyled"
        onClick={() => onOpen(piece)}
        aria-label={`View ${piece.label.toLowerCase()} ${piece.id}`}
      >
        <span className="workItem__marks" aria-hidden="true" />
        <span className="workItem__frame">
          <img
            src={`/work/web/${piece.file}-${piece.widths[0]}.webp`}
            srcSet={workSrcSet(piece)}
            sizes={sizes}
            width={piece.width}
            height={piece.height}
            alt={workAlt(piece)}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </span>
      </button>
      <figcaption>
        <WorkMeta piece={piece} />
      </figcaption>
    </figure>
  );
}
