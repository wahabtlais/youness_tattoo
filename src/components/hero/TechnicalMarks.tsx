import type { RefObject } from 'react';

/**
 * Barely-there print furniture behind the hero: a construction circle around
 * the portrait, a crosshair, a margin rule with a plate number. If any of
 * this starts competing with the name or the portrait, delete it.
 */
export function TechnicalMarks({ parallaxRef }: { parallaxRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="heroMarks" ref={parallaxRef} aria-hidden="true">
      <svg className="heroMarks__circle" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <circle cx="50" cy="50" r="49.8" />
        <path d="M50 -3v8M50 95v8M-3 50h8M95 50h8" />
      </svg>
      <span className="heroMarks__cross" />
      <span className="heroMarks__rule">
        <b>01</b>
      </span>
    </div>
  );
}
