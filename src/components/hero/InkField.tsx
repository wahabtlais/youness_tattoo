import { useEffect, useRef, type RefObject } from 'react';
import fieldUrl from '../../assets/ink/ink-large.webp';
import field from '../../assets/ink/ink-large.json';
import './InkField.css';

/**
 * The very large ink element - a huge, almost transparent field of ink that
 * enters the paper from the top-left corner and spreads in behind the
 * artist's head and shoulders. Big in area, low in visual weight.
 *
 * Source: the pool at the end of the licensed "Splatters" clip, which the
 * shot itself cuts off at its top-left - real frames of it growing, let
 * spread into the paper by scripts/build-ink.py (see docs/INK_ASSETS.md).
 *
 * Motion - the same life as the medium and small drops, on a bigger
 * scale: the ink lands (the real frames step through at the footage's own
 * timings, slowed a little for its size - first drop, a second beside it,
 * the merge, the pool spreading and throwing its spray), settles, holds
 * almost still, fades very slowly, then rests before landing again. One
 * ~38s cycle with a random starting point, so it never lines up with the
 * drops.
 *
 * Web Animations API, paused while the hero is off screen. The medium and
 * small ink elements live in InkDrops.
 *
 * Removable: delete this file, its CSS and the ink-large.* assets, then the
 * <InkField> line and its ref in Hero.tsx.
 */

const CYCLE = 38; // seconds
/** the landing plays at the footage's timings, stretched for its size */
const LAND_STRETCH = 1.8;
const LAND_AT = 0.4; // seconds into the cycle
const XFADE = 0.18; // seconds between real frames - soft, not a hard cut
/** fractions of the cycle */
const HOLD = 0.55;
const GONE = 0.8;

const at = (seconds: number) => Math.min(Math.max(seconds / CYCLE, 0), 0.999);
const landed = (i: number) => LAND_AT + field.times[i] * LAND_STRETCH;

// each real frame: in as it lands, then it stays - the pool only ever grows,
// so every later frame covers it
function stateKeys(i: number): Keyframe[] {
  const t = landed(i);
  return [
    { offset: 0, opacity: 0 },
    { offset: at(t - XFADE), opacity: 0, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    { offset: at(t), opacity: 1 },
    { offset: 1, opacity: 1 },
  ];
}

interface InkFieldProps {
  /** its own parallax plane, a little deeper than the portrait */
  parallaxRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}

export function InkField({ parallaxRef, reducedMotion }: InkFieldProps) {
  const growRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = parallaxRef.current;
    const grow = growRef.current;
    if (reducedMotion || !layer || !grow || typeof grow.animate !== 'function') return;

    const timing = {
      duration: CYCLE * 1000,
      iterations: Infinity,
      delay: -Math.random() * CYCLE * 1000,
      fill: 'both' as const,
    };
    const states = Array.from(grow.querySelectorAll<HTMLElement>('.inkField__state'));
    const anims = states.map((el, i) => el.animate(stateKeys(i), timing));
    // the whole mark: settles a hair outward as it spreads, holds, fades very
    // slowly, rests. On an inner wrapper, so it multiplies with the field's
    // own (very low) opacity
    const settled = at(landed(states.length - 1) + 0.8);
    anims.push(
      grow.animate(
        [
          { offset: 0, opacity: 1, transform: 'scale(0.985)' },
          { offset: at(LAND_AT), opacity: 1, transform: 'scale(0.985)', easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
          { offset: settled, opacity: 1, transform: 'scale(1)' },
          { offset: HOLD, opacity: 1, transform: 'scale(1)', easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
          { offset: GONE, opacity: 0, transform: 'scale(1.004)' },
          { offset: 1, opacity: 0, transform: 'scale(1.004)' },
        ],
        timing,
      ),
    );
    layer.dataset.animated = 'true';

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
    <div className="inkField" ref={parallaxRef} aria-hidden="true">
      <div className="inkField__scroll">
        <div className="inkField__body">
          <div className="inkField__grow" ref={growRef}>
            {Array.from({ length: field.frames }, (_, i) => (
            <div
              key={i}
              className={`inkField__state${i === field.frames - 1 ? ' inkField__state--grown' : ''}`}
              style={{
                backgroundImage: `url(${fieldUrl})`,
                backgroundSize: `${field.frames * 100}% 100%`,
                backgroundPosition: `${(i / (field.frames - 1)) * 100}% 0`,
              }}
            />
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
