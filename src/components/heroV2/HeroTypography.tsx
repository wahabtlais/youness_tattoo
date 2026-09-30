import type { CSSProperties, RefObject } from 'react';
import { InkFragments } from './InkFragments';

const LETTERS = ['Y', 'O', 'U', 'N', 'E', 'S'];
/** the burgundy letters - two anchors flanking the portrait: Y[O]UN[E]S */
const ACCENTS = new Set([1, 4]);
/** per-letter vertical drift when the word starts to move on scroll (phase 1) */
const DRIFT = [-0.9, 0.5, -1.6, 0.8, -0.4, 1.1];

/**
 * - back:      the full word, behind the portrait
 * - knock:     paper-coloured copy of the ink-black letters, masked to the
 *              portrait's silhouette - a veil printed *through* the photograph
 * - ink:       the burgundy letters, masked to the silhouette and multiplied,
 *              so where they cross skin they read as ink in the skin
 * - fragments: invisible glyph run carrying the ink fragments, so they sit
 *              in each letter's own coordinates above the portrait
 * All planes render identical glyph runs so they stay in register.
 */
export type TypePlane = 'back' | 'knock' | 'ink' | 'fragments';

interface HeroTypographyProps {
  plane: TypePlane;
  parallaxRef: RefObject<HTMLDivElement | null>;
  wordRef?: RefObject<HTMLDivElement | null>;
  style?: CSSProperties;
}

export function HeroTypography({ plane, parallaxRef, wordRef, style }: HeroTypographyProps) {
  return (
    <div className={`hv2Type hv2Type--${plane}`} ref={parallaxRef} aria-hidden="true">
      <div className="hv2Type__scroll">
        <div className="hv2Word" ref={wordRef} style={style}>
          {LETTERS.map((letter, i) => (
            <span
              key={i}
              className={ACCENTS.has(i) ? 'is-accent' : undefined}
              style={{ '--i': i, '--dy': DRIFT[i] } as CSSProperties}
            >
              {letter}
              {plane === 'fragments' && <InkFragments letter={i} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
