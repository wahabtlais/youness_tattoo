import type { RefObject } from 'react';

/**
 * Barely-there print furniture behind Hero V2: a construction circle around
 * the portrait, a crosshair, a margin rule with a plate number. If any of
 * this starts competing with the name or the portrait, delete it.
 */
export function TechnicalMarks({ parallaxRef }: { parallaxRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="hv2Marks" ref={parallaxRef} aria-hidden="true">
      <svg className="hv2Marks__circle" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <circle cx="50" cy="50" r="49.8" />
        <path d="M50 -3v8M50 95v8M-3 50h8M95 50h8" />
      </svg>
      <span className="hv2Marks__cross" />
      <span className="hv2Marks__rule">
        <b>01</b>
      </span>
    </div>
  );
}
