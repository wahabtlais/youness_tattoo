import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { ArtistPortrait } from '../components/heroV2/ArtistPortrait';
import { HeroTypography } from '../components/heroV2/HeroTypography';
import { TechnicalMarks } from '../components/heroV2/TechnicalMarks';
import { VoiceTrigger } from '../components/heroV2/VoiceTrigger';
import { Cursor } from '../components/Cursor';
import { useRevealEngine, type ParallaxLayer } from '../hooks/useRevealEngine';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useRegisteredMask } from '../hooks/useRegisteredMask';
import printUrl from '../assets/hero-v2/artist-print.webp';
import developUrl from '../assets/hero-v2/artist-develop.webp';
import './HeroV2.css';

// Pointer parallax depth per plane (px at the viewport edge). The portrait
// barely moves, the type moves more, the paper furniture most - like loose
// printed sheets sliding over one another.
const DEPTH = {
  portrait: { x: 5, y: 3 },
  type: { x: 10, y: 6 },
  marks: { x: 18, y: 11 },
};

// ~52px radius at 1440: a precise loupe, not a torch
const SPOT_RADIUS = { min: 40, max: 56, vw: 0.036 };

// no statue zones here - the tattoo layer will bring its own
const NO_ZONES: never[] = [];

const knockMaskStyle = {
  WebkitMaskImage: `url(${printUrl})`,
  maskImage: `url(${printUrl})`,
} as CSSProperties;

/**
 * Hero V2 - editorial experiment. The artist's name is the structure of the
 * page and his portrait is printed into it. Lives beside the original Hero
 * (see the dev switch in App) so the two can be compared.
 */
export function HeroV2() {
  const stageRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const revealParallaxRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const knockRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const fragmentsRef = useRef<HTMLDivElement>(null);
  const knockWordRef = useRef<HTMLDivElement>(null);
  const inkWordRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useReducedMotion();

  const layers: ParallaxLayer[] = [
    { ref: portraitRef, ...DEPTH.portrait },
    { ref: revealParallaxRef, ...DEPTH.portrait },
    { ref: backRef, ...DEPTH.type },
    { ref: knockRef, ...DEPTH.type },
    { ref: inkRef, ...DEPTH.type },
    { ref: fragmentsRef, ...DEPTH.type },
    { ref: marksRef, ...DEPTH.marks },
  ];

  const { isFinePointer } = useRevealEngine({
    inkRef: revealRef,
    parallaxLayers: layers,
    zones: NO_ZONES,
    radius: SPOT_RADIUS,
    cursorRef,
    reducedMotion,
  });

  // The fixed nav picks up how far the word has collapsed toward it (phase 3).
  const onProgress = useCallback((p: number) => {
    const q = Math.min(1, Math.max(0, (p - 0.2) / 0.45));
    document.documentElement.style.setProperty('--hero-v2-q', q.toFixed(3));
  }, []);
  useScrollProgress(stageRef, { disabled: reducedMotion, onProgress });
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--hero-v2-q');
    };
  }, []);

  useRegisteredMask([knockWordRef, inkWordRef], plateRef, stageRef);

  // Is the pointer over the portrait? Drives the soft fade-in of the reveal
  // and the hint's response. Written as a data attribute, not React state,
  // so pointer movement never re-renders. Touch has no hover: the engine's
  // autonomous drift carries the spotlight, so the reveal simply stays on.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!matchMedia('(pointer: fine)').matches) {
      stage.dataset.reveal = 'on';
      return;
    }
    let over = false;
    // ink fragments brighten as the cursor nears them (--near 0..1)
    const inks = Array.from(stage.querySelectorAll<HTMLElement>('.hv2Type--fragments .ink'));
    const NEAR_PX = 190;
    let raf = 0;
    let px = -1e4;
    let py = -1e4;
    function updateNear() {
      raf = 0;
      for (const el of inks) {
        const b = el.getBoundingClientRect();
        const d = Math.hypot(px - (b.left + b.width / 2), py - (b.top + b.height / 2));
        el.style.setProperty('--near', Math.max(0, 1 - d / NEAR_PX).toFixed(2));
      }
    }
    function onMove(e: PointerEvent) {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(updateNear);
      const r = plateRef.current?.getBoundingClientRect();
      if (!r) return;
      // a little inset: the plate box includes paper around the silhouette
      const now =
        e.clientX > r.left + r.width * 0.08 &&
        e.clientX < r.right - r.width * 0.08 &&
        e.clientY > r.top + r.height * 0.04 &&
        e.clientY < r.bottom - r.height * 0.18;
      if (now !== over) {
        over = now;
        stage!.dataset.reveal = now ? 'on' : 'off';
      }
    }
    function onLeave() {
      over = false;
      stage!.dataset.reveal = 'off';
    }
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <section className="hv2" id="hero" ref={stageRef} aria-labelledby="hv2Title" data-reveal="off">
      <TechnicalMarks parallaxRef={marksRef} />

      <HeroTypography plane="back" parallaxRef={backRef} />
      <ArtistPortrait
        plane="rest"
        src={printUrl}
        alt="Younes, tattoo artist, arms crossed in a black t-shirt and gloves"
        parallaxRef={portraitRef}
        plateRef={plateRef}
      />
      <HeroTypography plane="knock" parallaxRef={knockRef} wordRef={knockWordRef} style={knockMaskStyle} />
      <HeroTypography plane="ink" parallaxRef={inkRef} wordRef={inkWordRef} style={knockMaskStyle} />
      <HeroTypography plane="fragments" parallaxRef={fragmentsRef} />
      <ArtistPortrait plane="reveal" src={developUrl} parallaxRef={revealParallaxRef} plateRef={revealRef} />

      <div className="hv2Fade" aria-hidden="true" />
      <div className="hv2Grain" aria-hidden="true" />

      <div className="hv2Ui">
        <h1 className="hv2Title" id="hv2Title">
          <span className="visually-hidden">Younes - </span>
          <span className="hv2Meta">
            <span>Tattoo artist</span>
            <span className="hv2Meta__sep" aria-hidden="true">
              {' '}
              &middot;{' '}
            </span>
            <span>Detroit, Michigan</span>
          </span>
        </h1>
        <p className="hv2Line">
          The work is already in <em>you.</em>
        </p>

        <div className="hv2Hint">
          <span className="hv2Hint__dot" aria-hidden="true" />
          {isFinePointer ? 'Move to reveal' : 'Touch to reveal'}
        </div>

        <div className="hv2Voice">
          <VoiceTrigger />
        </div>
      </div>

      {isFinePointer && <Cursor ref={cursorRef} />}
    </section>
  );
}
