import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArtistPortrait } from '../components/hero/ArtistPortrait';
import { HeroTypography } from '../components/hero/HeroTypography';
import { TechnicalMarks } from '../components/hero/TechnicalMarks';
import { VoiceTrigger } from '../components/hero/VoiceTrigger';
import { InkDrops } from '../components/hero/InkDrops';
import { InkField } from '../components/hero/InkField';
import { useHeroMotion, type ParallaxLayer } from '../hooks/useHeroMotion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { HERO_PORTRAIT } from '../components/hero/heroPortrait';
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

// the knock-out type is printed through the portrait: masked by the
// portrait's own alpha (the smallest file - only its silhouette matters)
const knockMaskStyle = {
  WebkitMaskImage: `url(${HERO_PORTRAIT.mask})`,
  maskImage: `url(${HERO_PORTRAIT.mask})`,
} as CSSProperties;

/** the browser can run the hero's scroll choreography on the compositor (see Hero.css) */
const SCROLL_TIMELINE = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');

interface HeroProps {
  /** opens the Ask Younes consultation shell */
  onAsk: () => void;
}

/**
 * The artist's name is the structure of the page and his portrait is
 * printed into it. Ask Younes sits on the centre line under him.
 *
 * All pointer and scroll work is one loop (useHeroMotion): the parallax
 * planes, the knock-out masks kept in register, the ink giving way near
 * the pointer, and the scroll progress the masthead reads. The system
 * cursor is the cursor.
 */
export const Hero = memo(function Hero({ onAsk }: HeroProps) {
  const stageRef = useRef<HTMLElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const knockRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const knockWordRef = useRef<HTMLDivElement>(null);
  const inkWordRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);
  const inkDropsRef = useRef<HTMLDivElement>(null);
  const inkFieldRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useReducedMotion();

  // The hero was already painted from static HTML before this script ran
  // (index.html, scripts/prerender-hero.mjs) and its entrance has been
  // playing since: carry on from there rather than start again (Hero.css,
  // --hero-elapsed). Before the browser paints this render.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!('heroShell' in root.dataset)) return;
    delete root.dataset.heroShell;
    const shown = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    const elapsed = shown === undefined ? 0 : Math.max(0, performance.now() - shown) / 1000;
    stageRef.current?.style.setProperty('--hero-elapsed', `${elapsed.toFixed(3)}s`);
  }, []);
  // the portrait is the first paint; the ink's images load once it has (one state change)
  const [portraitLoaded, setPortraitLoaded] = useState(false);
  const portraitDone = useCallback(() => setPortraitLoaded(true), []);

  // indices matter: the masks below name the planes they ride on
  const layers: ParallaxLayer[] = [
    { ref: portraitRef, ...DEPTH.portrait }, // 0
    { ref: backRef, ...DEPTH.type }, // 1
    { ref: knockRef, ...DEPTH.type }, // 2
    { ref: inkRef, ...DEPTH.type }, // 3
    { ref: marksRef, ...DEPTH.marks },
    { ref: inkDropsRef, ...DEPTH.ink }, // 5
    { ref: inkFieldRef, ...DEPTH.field },
  ];

  // The fixed nav picks up how far the word has collapsed toward it (phase 3)
  // and when to lay its paper strip (--hero-q / --hero-p). Written on the
  // masthead itself - its only reader - not on <html>: a custom property on
  // the root is inherited by every element, so each scroll frame would
  // restyle the whole document.
  const onProgress = useCallback((p: number) => {
    const q = Math.min(1, Math.max(0, (p - 0.2) / 0.45));
    const nav = document.querySelector<HTMLElement>('.siteNav')?.style;
    nav?.setProperty('--hero-q', q.toFixed(3));
    nav?.setProperty('--hero-p', p.toFixed(4));
  }, []);
  // leaving the home page: the masthead goes back to its inner-page look
  useEffect(() => {
    return () => {
      const nav = document.querySelector<HTMLElement>('.siteNav')?.style;
      nav?.removeProperty('--hero-q');
      nav?.removeProperty('--hero-p');
    };
  }, []);

  useHeroMotion({
    stageRef,
    layers,
    mask: {
      source: plateRef,
      sourceLayer: 0,
      masked: [
        { ref: knockWordRef, layer: 2 },
        { ref: inkWordRef, layer: 3 },
      ],
    },
    // ink drops nudge a few px away from a nearby pointer (their CSS eases it)
    reactiveSelector: '[data-ink-react]',
    reactiveLayer: 5,
    reducedMotion,
    // where scroll-driven animations exist, Hero.css runs every scroll layer
    // on the compositor and nothing reads --p
    progressVar: SCROLL_TIMELINE ? undefined : '--p',
    onProgress,
  });

  return (
    <section className="hero" id="hero" ref={stageRef} aria-labelledby="heroTitle">
      <InkField parallaxRef={inkFieldRef} reducedMotion={reducedMotion} loaded={portraitLoaded} />
      <InkDrops parallaxRef={inkDropsRef} reducedMotion={reducedMotion} loaded={portraitLoaded} />
      <TechnicalMarks parallaxRef={marksRef} />

      <HeroTypography plane="back" parallaxRef={backRef} />
      <ArtistPortrait
        alt="Younes, tattoo artist, arms crossed in a black t-shirt and gloves"
        parallaxRef={portraitRef}
        plateRef={plateRef}
        onLoad={portraitDone}
      />
      <HeroTypography plane="knock" parallaxRef={knockRef} wordRef={knockWordRef} style={knockMaskStyle} />
      <HeroTypography plane="ink" parallaxRef={inkRef} wordRef={inkWordRef} style={knockMaskStyle} />

      <div className="heroFade" aria-hidden="true" />
      <div className="heroGrain" aria-hidden="true" />

      <div className="heroUi">
        <h1 className="heroTitle" id="heroTitle">
          <span className="sr-only">Younes - </span>
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
    </section>
  );
});
