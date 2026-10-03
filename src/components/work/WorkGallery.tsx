import { useEffect, useRef, type ReactNode } from 'react';
import type { TattooWork } from '../../domain/work';
import { WorkItem } from './WorkItem';

interface WorkGalleryProps {
  pieces: TattooWork[];
  onOpen: (piece: TattooWork) => void;
  /** closing cell of the composition (e.g. the Ask Younes line) */
  children?: ReactNode;
}

// matches the columns the items span in Work.css at each breakpoint
const SIZES = '(max-width: 699px) 100vw, (max-width: 1099px) 55vw, 40vw';

/**
 * The archive wall. Placement lives in Work.css (per slot, per breakpoint)
 * so the data stays presentation-free. On fine pointers a small "View"
 * label trails the cursor while it's over a piece.
 */
export function WorkGallery({ pieces, onOpen, children }: WorkGalleryProps) {
  const wallRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wall = wallRef.current;
    const cue = cueRef.current;
    if (!wall || !cue || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    function onMove(e: PointerEvent) {
      cue!.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      const over = (e.target as Element).closest('.workItem__open');
      cue!.dataset.on = over ? 'true' : 'false';
    }
    function onLeave() {
      cue!.dataset.on = 'false';
    }
    wall.addEventListener('pointermove', onMove, { passive: true });
    wall.addEventListener('pointerleave', onLeave);
    return () => {
      wall.removeEventListener('pointermove', onMove);
      wall.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="workGallery" ref={wallRef}>
      {pieces.map((piece, i) => (
        <WorkItem key={piece.id} piece={piece} slot={i + 1} sizes={SIZES} onOpen={onOpen} />
      ))}
      {children && <div className="workGallery__coda">{children}</div>}
      <span className="workCue" ref={cueRef} data-on="false" aria-hidden="true">
        View
      </span>
    </div>
  );
}
