import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import mediumUrl from '../../assets/ink/ink-medium.webp';
import smallUrl from '../../assets/ink/ink-small.webp';
import manifest from '../../assets/ink/drops.json';
import './InkDrops.css';

/**
 * Ink drops - occasionally, real ink lands on the sheet.
 *
 * The medium and small ink elements, cut from real footage of black ink dropped onto paper
 * (scripts/build-ink.py; source and licence in docs/INK_ASSETS.md). Each is
 * a short strip of frames - the landing point, the blot, later drops
 * merging in, the spray - stepped through at the footage's own timings.
 *
 * Each drop has its own cycle and a random starting phase:
 *   lands (the strip plays, ~3-4s) -> settles -> stays almost completely
 *   still -> fades slowly -> a long quiet rest -> lands again
 * so about two are on the paper at a time - sometimes one or three, now
 * and then none - and never on a beat.
 *
 * Driven by the Web Animations API (no rAF loop): two animations per drop,
 * paused while the hero is off screen. Cursor: drops carry data-ink-react
 * and the hero's existing pointer pass nudges a nearby drop a few px.
 *
 * Removable as a unit: delete this file, InkDrops.css, src/assets/ink,
 * scripts/build-ink.py and docs/INK_ASSETS.md, then the <InkDrops> line
 * and its ref in Hero.tsx.
 */

type DropName = keyof typeof manifest;

interface Drop {
  name: DropName;
  src: string;
  /** cycle length (s) - lengths share no rhythm */
  cycle: number;
  /** shown, settled, in the static reduced-motion state */
  rest?: boolean;
}

const DROPS: Drop[] = [
  // the medium mark (a soft, spreading merge) and the small one (a defined
  // impact with its ring of spray); the third, very large element is InkField
  { name: 'ink-medium', src: mediumUrl, cycle: 27.1, rest: true },
  { name: 'ink-small', src: smallUrl, cycle: 18.7, rest: true },
];

/** as fractions of each cycle: settled-and-still until HOLD, gone by FADE */
const HOLD = 0.47;
const FADE = 0.63;

function animate(drop: Drop, frames: HTMLElement, life: HTMLElement): Animation[] {
  const { frames: n, times } = manifest[drop.name];
  const T = drop.cycle;
  const at = (s: number) => Math.min(s / T, 0.99);
  // a random point in the cycle, so a reload never repeats the same rhythm
  const delay = -Math.random() * T * 1000;
  const timing = { duration: T * 1000, iterations: Infinity, delay, fill: 'both' as const };

  // the strip: hard cuts between real frames, at their real timings
  const strip: Keyframe[] = times.map((t, i) => ({
    offset: at(t),
    backgroundPosition: `${(i / (n - 1)) * 100}% 0`,
    easing: 'step-end',
  }));
  strip.push({ offset: 1, backgroundPosition: `100% 0` });

  // the drop on the page: a tiny contraction as it lands, then still; a
  // slow fade; nothing for the rest of the cycle
  const land = times[1];
  const lifeKeys: Keyframe[] = [
    { offset: 0, opacity: 1, transform: 'scale(0.96)' },
    { offset: at(land), opacity: 1, transform: 'scale(0.96)', easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
    { offset: at(land + 0.6), opacity: 1, transform: 'scale(1)' },
    { offset: HOLD, opacity: 1, transform: 'scale(1)', easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
    { offset: FADE, opacity: 0, transform: 'scale(1.004)' },
    { offset: 1, opacity: 0, transform: 'scale(1.004)' },
  ];

  return [frames.animate(strip, timing), life.animate(lifeKeys, timing)];
}

interface InkDropsProps {
  /** the layer drifts on its own parallax plane, driven by the reveal engine */
  parallaxRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}

export function InkDrops({ parallaxRef, reducedMotion }: InkDropsProps) {
  const dropRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const layer = parallaxRef.current;
    if (reducedMotion || !layer || typeof layer.animate !== 'function') return;

    const anims = DROPS.flatMap((drop, i) => {
      const el = dropRefs.current[i];
      const frames = el?.querySelector<HTMLElement>('.inkDrop__frames');
      const life = el?.querySelector<HTMLElement>('.inkDrop__life');
      return frames && life ? animate(drop, frames, life) : [];
    });
    layer.dataset.animated = 'true';

    // no ink lands while nobody can see the hero
    const io = new IntersectionObserver(([e]) => {
      for (const a of anims) {
        if (e.isIntersecting) a.play();
        else a.pause();
      }
    });
    io.observe(layer);

    return () => {
      io.disconnect();
      for (const a of anims) a.cancel();
      delete layer.dataset.animated;
    };
  }, [parallaxRef, reducedMotion]);

  return (
    <div className="inkDrops" ref={parallaxRef} aria-hidden="true">
      <div className="inkDrops__scroll">
        {DROPS.map((drop, i) => {
          const { frames, body } = manifest[drop.name];
          return (
            <div
              key={drop.name}
              ref={(el) => {
                dropRefs.current[i] = el;
              }}
              className={`inkDrop inkDrop--${drop.name}${drop.rest ? ' inkDrop--rest' : ''}`}
              style={{ '--body': body } as CSSProperties}
            >
              <div className="inkDrop__react" data-ink-react="">
                <div className="inkDrop__life">
                  <div
                    className="inkDrop__frames"
                    style={{ backgroundImage: `url(${drop.src})`, backgroundSize: `${frames * 100}% 100%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
