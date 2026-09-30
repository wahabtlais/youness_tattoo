import { forwardRef } from 'react';
import cleanUrl from '../assets/figure-clean.webp';
import inkUrl from '../assets/figure-ink.webp';
import './AngelFigure.css';

interface AngelFigureProps {
  figureParallaxRef: React.RefObject<HTMLDivElement | null>;
  inkRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The reveal figure: a clean plate and a transparent ink plate stacked and
 * registered pixel-for-pixel, with the ink plate masked to a small spotlight
 * that follows the cursor (see useRevealEngine). Currently rendering the
 * placeholder statue artwork - swap the two imports above for the real angel
 * artwork when it's ready, no other changes needed.
 */
export const AngelFigure = forwardRef<HTMLDivElement, AngelFigureProps>(function AngelFigure(
  { figureParallaxRef, inkRef },
  anchorRef
) {
  return (
    <div className="figureAnchor" ref={anchorRef}>
      <div className="figureFloat">
        <div className="figureParallax" ref={figureParallaxRef}>
          <div className="plate plate--clean" style={{ backgroundImage: `url(${cleanUrl})` }} />
          <div className="plate plate--ink" ref={inkRef} style={{ backgroundImage: `url(${inkUrl})` }} />
        </div>
      </div>
    </div>
  );
});
