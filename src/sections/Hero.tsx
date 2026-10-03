import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { ArtistPortrait } from '../components/hero/ArtistPortrait';
import { HeroTypography } from '../components/hero/HeroTypography';
import { TechnicalMarks } from '../components/hero/TechnicalMarks';
import { VoiceTrigger } from '../components/hero/VoiceTrigger';
import { InkDrops } from '../components/hero/InkDrops';
import { InkField } from '../components/hero/InkField';
import { Cursor } from '../components/Cursor';
import { useRevealEngine, type ParallaxLayer } from '../hooks/useRevealEngine';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useRegisteredMask } from '../hooks/useRegisteredMask';
import printUrl from '../assets/hero/artist-print.webp';
import developUrl from '../assets/hero/artist-develop.webp';
import './Hero.css';

// Pointer parallax depth per plane (px at the viewport edge). The portrait
// barely moves, the type moves more, the paper furniture most - like loose
// printed sheets sliding over one another.
const DEPTH = {
  portrait: { x: 5, y: 3 },
  type: { x: 10, y: 6 },
  /** ink drops on the paper: a separate sheet, a little deeper than the name */
  ink: { x: 13, y: 8 },
  /** the very large ink field behind him: just behind the portrait's plane */
  field: { x: 8, y: 5 },
  marks: { x: 18, y: 11 },
};

// ~52px radius at 1440: a precise loupe, not a torch
const SPOT_RADIUS = { min: 40, max: 56, vw: 0.036 };

const knockMaskStyle = {
  WebkitMaskImage: `url(${printUrl})`,
  maskImage: `url(${printUrl})`,
} as CSSProperties;

interface HeroProps {
  /** opens the Ask Younes consultation shell */
  onAsk: () => void;
}

/**
 * The artist's name is the structure of the page and his portrait is
 * printed into it. Ask Younes sits on the centre line under him.
 */
export function Hero({ onAsk }: HeroProps) {
  const stageRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const revealParallaxRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const knockRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const knockWordRef = useRef<HTMLDivElement>(null);
  const inkWordRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const inkDropsRef = useRef<HTMLDivElement>(null);
  const inkFieldRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useReducedMotion();

  const layers: ParallaxLayer[] = [
    { ref: portraitRef, ...DEPTH.portrait },
    { ref: revealParallaxRef, ...DEPTH.portrait },
    { ref: backRef, ...DEPTH.type },
    { ref: knockRef, ...DEPTH.type },
    { ref: inkRef, ...DEPTH.type },
    { ref: marksRef, ...DEPTH.marks },
    { ref: inkDropsRef, ...DEPTH.ink },
    { ref: inkFieldRef, ...DEPTH.field },
  ];

  const { isFinePointer } = useRevealEngine({
    plateRef: revealRef,
    parallaxLayers: layers,
    radius: SPOT_RADIUS,
    cursorRef,
    reducedMotion,
  });

  // The fixed nav picks up how far the word has collapsed toward it (phase 3),
  // and the Work section times its arrival from the same number (--hero-p).
  const onProgress = useCallback((p: number) => {
    const q = Math.min(1, Math.max(0, (p - 0.2) / 0.45));
    const root = document.documentElement.style;
    root.setProperty('--hero-q', q.toFixed(3));
    root.setProperty('--hero-p', p.toFixed(4));
  }, []);
  useScrollProgress(stageRef, { disabled: reducedMotion, onProgress });
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--hero-q');
      document.documentElement.style.removeProperty('--hero-p');
    };
  }, []);

  useRegisteredMask([knockWordRef, inkWordRef], plateRef, stageRef);

  // Is the pointer over the portrait? Drives the soft fade-in of the reveal.
  // Written as a data attribute, not React state,
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
    // ink ([data-ink-react]) gets its nearness to the cursor (--near 0..1), a
    // unit vector away from it scaled by nearness (--ax / --ay) and a rotation
    // sign (--ar); its CSS turns that into a few px of give and eases back
    // when the cursor moves on
    const reactive = Array.from(stage.querySelectorAll<HTMLElement>('[data-ink-react]'));
    const REACT_PX = 240;
    let raf = 0;
    let px = -1e4;
    let py = -1e4;
    function updateNear() {
      raf = 0;
      for (const el of reactive) {
        const b = el.getBoundingClientRect();
        const dx = b.left + b.width / 2 - px;
        const dy = b.top + b.height / 2 - py;
        const d = Math.hypot(dx, dy) || 1;
        const near = Math.max(0, 1 - d / REACT_PX) ** 1.5;
        el.style.setProperty('--near', near.toFixed(3));
        el.style.setProperty('--ax', ((dx / d) * near).toFixed(3));
        el.style.setProperty('--ay', ((dy / d) * near).toFixed(3));
        el.style.setProperty('--ar', (Math.sign(dx) * near).toFixed(3));
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
      for (const el of reactive) {
        for (const v of ['--near', '--ax', '--ay', '--ar']) el.style.setProperty(v, '0');
      }
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
    <section className="hero" id="hero" ref={stageRef} aria-labelledby="heroTitle" data-reveal="off">
      <InkField parallaxRef={inkFieldRef} reducedMotion={reducedMotion} />
      <InkDrops parallaxRef={inkDropsRef} reducedMotion={reducedMotion} />
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
      <ArtistPortrait plane="reveal" src={developUrl} parallaxRef={revealParallaxRef} plateRef={revealRef} />

      <div className="heroFade" aria-hidden="true" />
      <div className="heroGrain" aria-hidden="true" />

      <div className="heroUi">
        <h1 className="heroTitle" id="heroTitle">
          <span className="visually-hidden">Younes - </span>
          <span className="heroMeta">
            <span>Tattoo artist</span>
            <span className="heroMeta__sep" aria-hidden="true">
              {' '}
              &middot;{' '}
            </span>
            <span>Detroit, Michigan</span>
          </span>
        </h1>
        <p className="heroLine">
          The work is already in <em>you.</em>
        </p>

        <div className="heroVoice">
          <VoiceTrigger onActivate={onAsk} />
        </div>

        <a className="heroNext" href="#work">
          <span className="heroNext__num">02</span>
          The work
        </a>
      </div>

      {isFinePointer && <Cursor ref={cursorRef} />}
    </section>
  );
}
