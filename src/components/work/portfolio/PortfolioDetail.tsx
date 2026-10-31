import { gsap } from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import type { TattooWork } from '../../../domain/work';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { WorkPhysicalDetail, type PickedPrint } from '../physical-archive/WorkPhysicalDetail';
import '../physical-archive/physicalArchive.css';

interface PortfolioDetailProps {
  pieces: TattooWork[];
  /** the open piece, or null */
  slug: string | null;
  onClose: () => void;
  onFindSimilar: (piece: TattooWork) => void;
  onOpen: (slug: string) => void;
}

/** the print's proportions for the detail layout (its own photograph's, with the archive's border) */
const pickedFor = (pieces: TattooWork[], index: number): PickedPrint => {
  const { image } = pieces[index];
  return { index, w: 300, h: (300 * image.height) / image.width, border: 9, src: image.src };
};

/**
 * Work Detail V1 - the approved detail - opened from the portfolio page
 * rather than the rope. It is the same component, laid out the same way,
 * with the same Close, Escape, outside click and "Find similar"; only the
 * arrival differs: with no print on a rope to fly in, the paper is laid and
 * the print and its words rise onto it (at once, under reduced motion).
 * The dialog gives focus back to the piece in the grid when it closes.
 */
export function PortfolioDetail({ pieces, slug, onClose, onFindSimilar, onOpen }: PortfolioDetailProps) {
  const reduced = useReducedMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const armCanvasRef = useRef<HTMLCanvasElement>(null);
  const index = slug ? pieces.findIndex((p) => p.slug === slug) : -1;
  const picked = index >= 0 ? pickedFor(pieces, index) : null;

  useLayoutEffect(() => {
    const paper = paperRef.current;
    const slot = slotRef.current;
    if (index < 0 || !paper || !slot) return;
    const text = [...(paper.parentElement?.querySelectorAll<HTMLElement>('[data-detail-text]') ?? [])];
    // focus what was opened once it can take focus: the dialog opens in an
    // effect after this one, and the title is hidden until it has risen in
    const focusTitle = () => titleRef.current?.focus({ preventScroll: true });
    if (reduced) {
      gsap.set([paper, slot], { autoAlpha: 1, y: 0 });
      gsap.set(text, { autoAlpha: 1, y: 0 });
      const raf = requestAnimationFrame(focusTitle);
      return () => cancelAnimationFrame(raf);
    }
    const tl = gsap.timeline({ onComplete: focusTitle });
    tl.fromTo(paper, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.inOut' }, 0);
    tl.fromTo(slot, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.12);
    tl.fromTo(text, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out' }, 0.3);
    return () => {
      tl.kill();
    };
  }, [index, reduced]);

  return (
    <WorkPhysicalDetail
      pieces={pieces}
      picked={picked}
      onClose={onClose}
      onFindSimilar={onFindSimilar}
      onOpenOther={(i) => onOpen(pieces[i].slug)}
      paperRef={paperRef}
      slotRef={slotRef}
      cloneRef={cloneRef}
      titleRef={titleRef}
      armCanvasRef={armCanvasRef}
    />
  );
}
