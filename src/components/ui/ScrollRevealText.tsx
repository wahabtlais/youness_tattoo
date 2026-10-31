import { useRef, type CSSProperties, type ElementType } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useRevealProgress } from '../../hooks/useRevealProgress';
import { cx } from '../../lib/cx';

interface ScrollRevealTextProps {
  text: string;
  /** the element it is (h2, p…), with its own typography */
  as?: ElementType;
  id?: string;
  className?: string;
  /**
   * opacity a word starts at - readable from the first moment: 0.5 holds
   * 3.3:1 on the stone stock (large display text); body text needs ~0.65
   */
  from?: number;
}

/** how many words fade in together, so the reveal reads as a soft front, not a ticker */
const SPREAD = 3;

/**
 * Text that settles from faint to full ink, word by word, as it moves
 * through the reading area (useRevealProgress). One CSS variable drives
 * every word: each word's opacity is computed in CSS from its index, so
 * nothing re-renders while scrolling. Words are plain inline spans in
 * normal flow - the text wraps, reads and is announced exactly as written,
 * once. Without the variable (reduced motion, no JS) every word is full ink.
 */
export function ScrollRevealText({ text, as: Tag = 'p', id, className, from = 0.5 }: ScrollRevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useRevealProgress(ref, { disabled: reduced });
  const words = text.split(/\s+/).filter(Boolean);
  const n = words.length;

  return (
    <Tag ref={ref} id={id} className={cx(className)} style={{ '--n': n, '--from': from } as CSSProperties}>
      {words.map((word, i) => (
        <span
          // the text is fixed for the life of the element; index + word is stable
          key={`${i}-${word}`}
          style={{
            opacity: `calc(var(--from) + (1 - var(--from)) * clamp(0, (var(--reveal, 1) * (var(--n) + ${SPREAD}) - ${i}) / ${SPREAD}, 1))`,
          }}
        >
          {word}
          {i < n - 1 && ' '}
        </span>
      ))}
    </Tag>
  );
}
