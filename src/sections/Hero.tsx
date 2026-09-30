import { useEffect, useRef } from 'react';
import { AngelFigure } from '../components/AngelFigure';
import { GalleryFrames } from '../components/GalleryFrames';
import { Cursor } from '../components/Cursor';
import { ZoneReadout } from '../components/ZoneReadout';
import { HeroCopy } from '../components/HeroCopy';
import { useRevealEngine } from '../hooks/useRevealEngine';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './Hero.css';

export function Hero() {
  const stageRef = useRef<HTMLElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const figureAnchorRef = useRef<HTMLDivElement>(null);
  const figureParallaxRef = useRef<HTMLDivElement>(null);
  const framesParallaxRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useReducedMotion();
  const { activeZone, isFinePointer } = useRevealEngine({
    inkRef,
    figureParallaxRef,
    framesParallaxRef,
    cursorRef,
    reducedMotion,
  });

  // Hero -> Work transition (brief step 14): as the hero scrolls past, ease
  // the figure and wall out rather than cutting at a hard boundary. Plain
  // scroll listener + rAF, transform/opacity only - no scroll-hijacking,
  // normal document flow keeps driving the scroll itself.
  useEffect(() => {
    if (reducedMotion) return;
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = stage!.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.7)));
        stage!.style.setProperty('--exit', progress.toFixed(3));
      });
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
    };
  }, [reducedMotion]);

  return (
    <section className="stage" id="hero" ref={stageRef}>
      <div className="figureLayer">
        <GalleryFrames ref={framesParallaxRef} />
        <AngelFigure ref={figureAnchorRef} figureParallaxRef={figureParallaxRef} inkRef={inkRef} />
      </div>

      <div className="vig" />

      <div className="ui">
        <HeroCopy />
        <div className="heroZone">
          <ZoneReadout zone={activeZone} />
          <div className="legend">Beirut &middot; by appointment</div>
        </div>
      </div>

      {isFinePointer && <Cursor ref={cursorRef} />}
    </section>
  );
}
