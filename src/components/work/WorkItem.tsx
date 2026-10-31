import type { CSSProperties } from 'react';
import { useInView } from '../../hooks/useInView';
import { workShape, type TattooWork } from '../../domain/work';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { WorkMeta } from './WorkMeta';

interface WorkItemProps {
  piece: TattooWork;
  /** placement slot in the gallery composition (1-based) */
  slot: number;
  sizes: string;
  onOpen: (piece: TattooWork) => void;
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
      className={`workItem workItem--${slot} workItem--${workShape(piece)}`}
      ref={ref}
      data-in={inView}
      style={{ '--ar': `${piece.image.width} / ${piece.image.height}` } as CSSProperties}
    >
      <button
        type="button"
        className="workItem__open unstyled"
        onClick={() => onOpen(piece)}
        aria-label={`View ${piece.title.toLowerCase()} ${piece.id}`}
      >
        <span className="workItem__marks" aria-hidden="true" />
        <span className="workItem__frame">
          <ResponsiveImage image={piece.image} alt={piece.alt} sizes={sizes} draggable={false} />
        </span>
      </button>
      <figcaption>
        <WorkMeta piece={piece} />
      </figcaption>
    </figure>
  );
}
