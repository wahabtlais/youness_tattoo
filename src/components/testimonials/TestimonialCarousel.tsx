import { useId, useRef, useState } from 'react';
import type { ClientTestimonial, DemoTestimonial } from '../../domain/client';
import type { ImageAsset } from '../../domain/media';
import { cx } from '../../lib/cx';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { TestimonialPortrait } from './TestimonialPortrait';
import { useAutoAdvance } from './useAutoAdvance';
import { VoiceNote } from './VoiceNote';

type Testimonial = ClientTestimonial | DemoTestimonial;

/** a tattoo shown beside a testimonial, with what it is */
export interface TestimonialArtwork {
  image: ImageAsset;
  alt: string;
  /** e.g. "Portfolio image — demo" */
  caption: string;
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
  /** by testimonial id: the artwork shown beside it, if any */
  artwork?: Record<string, TestimonialArtwork>;
  reducedMotion: boolean;
}

/** a calm stay per testimonial, longer for longer words: 7-11s */
const stayFor = (t: Testimonial) => Math.min(11_000, Math.max(7_000, 4_000 + t.quote.length * 30));

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The testimonials one at a time, each complete where it stands: who is
 * speaking (portrait, name, context), what they said, and - when there is
 * a recording - a way to hear it. Nothing opens elsewhere.
 *
 * It is a native scroll-snap row, so touch users simply swipe; the
 * previous / next controls and the position ("02 / 03") sit under it. It
 * turns on its own, calmly (useAutoAdvance: 7-11s each, held while the
 * visitor is reading, listening or interacting), never under reduced
 * motion, and a small control stops and restarts it. Only the testimonial
 * showing is interactive (the others are inert), and leaving one pauses
 * its recording. Audio never starts by itself.
 */
export function TestimonialCarousel({ testimonials, artwork, reducedMotion }: TestimonialCarouselProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const total = testimonials.length;
  const viewportId = useId();
  const canTurn = !reducedMotion && total > 1;
  const turning = canTurn && !stopped;

  /** where a turn by button or timer is heading: the stories it glides past don't count */
  const heading = useRef<number | null>(null);

  const goTo = (i: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const next = (i + total) % total;
    heading.current = next;
    setActive(next);
    el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  useAutoAdvance({
    regionRef,
    enabled: turning,
    active,
    delay: stayFor(testimonials[active]),
    onAdvance: () => goTo(active + 1),
  });

  return (
    <div ref={regionRef} role="region" aria-roledescription="carousel" aria-label="Client stories">
      <div className="relative border-y border-rule">
        {/* construction: registration crosses on the frame's four corners */}
        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((at) => (
          <span key={at} aria-hidden="true" className={cx('pointer-events-none absolute z-10 size-2.5', at, at.includes('left') ? '-translate-x-1/2' : 'translate-x-1/2', at.includes('top') ? '-translate-y-1/2' : 'translate-y-1/2')}>
            <span className="absolute inset-x-0 top-1/2 h-px bg-burgundy" />
            <span className="absolute inset-y-0 left-1/2 w-px bg-burgundy" />
          </span>
        ))}
        <div
          ref={viewportRef}
          id={viewportId}
          onScroll={(e) => {
            const el = e.currentTarget;
            const at = el.scrollLeft / Math.max(1, el.clientWidth);
            if (heading.current !== null) {
              // gliding to a chosen story (03 -> 01 passes 02): wait until it arrives
              if (Math.abs(at - heading.current) < 0.01) heading.current = null;
              return;
            }
            const i = Math.min(total - 1, Math.max(0, Math.round(at)));
            if (i !== active) setActive(i);
          }}
          // a swipe or trackpad takes over from a glide in progress
          onPointerDown={() => (heading.current = null)}
          onWheel={() => (heading.current = null)}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {testimonials.map((t, i) => (
            <Slide key={t.id} testimonial={t} artwork={artwork?.[t.id]} index={i} total={total} active={i === active} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* announced when the visitor turns it, not every few seconds by itself */}
          <p aria-live={turning ? 'off' : 'polite'} className="type-meta text-ink-soft tabular-nums">
            <span className="sr-only">Story </span>
            <span className="text-burgundy">{two(active + 1)}</span> / {two(total)}
          </p>
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {testimonials.map((t, i) => (
              <span
                key={t.id}
                className={cx(
                  'h-px transition-[width,background-color] duration-(--duration-normal) ease-editorial motion-reduce:transition-none',
                  i === active ? 'w-8 bg-burgundy' : 'w-4 bg-ink-muted',
                )}
              />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canTurn && (
            <button
              type="button"
              onClick={() => setStopped((s) => !s)}
              aria-label={stopped ? 'Turn the stories automatically' : 'Stop the stories turning automatically'}
              className="mr-2 inline-flex min-h-11 items-center gap-2 type-meta text-ink-soft transition-colors duration-(--duration-fast) hover:text-burgundy"
            >
              <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2 fill-current">
                {stopped ? <path d="M1.5 0.5v9L9 5z" /> : <path d="M1.5 1h2.4v8H1.5zM6.1 1h2.4v8H6.1z" />}
              </svg>
              {stopped ? 'Play' : 'Pause'}
            </button>
          )}
          <NavButton dir="prev" controls={viewportId} onClick={() => goTo(active - 1)} />
          <NavButton dir="next" controls={viewportId} onClick={() => goTo(active + 1)} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ dir, controls, onClick }: { dir: 'prev' | 'next'; controls: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-controls={controls}
      aria-label={dir === 'prev' ? 'Previous story' : 'Next story'}
      className="grid size-11 place-items-center rounded-full border border-rule text-ink transition-colors duration-(--duration-fast) hover:border-burgundy hover:text-burgundy"
    >
      <svg aria-hidden="true" viewBox="0 0 16 10" className={cx('w-4 fill-none stroke-current', dir === 'prev' && 'rotate-180')} strokeWidth="1">
        <path d="M0 5h15M10.5 0.5 15 5l-4.5 4.5" />
      </svg>
    </button>
  );
}

function Slide({
  testimonial: t,
  artwork,
  index,
  total,
  active,
}: {
  testimonial: Testimonial;
  artwork?: TestimonialArtwork;
  index: number;
  total: number;
  active: boolean;
}) {
  const demo = 'demo' in t;
  return (
    <article
      aria-roledescription="slide"
      aria-label={`${two(index + 1)} of ${two(total)}: ${t.attribution}${demo ? ', a fictional example' : ''}`}
      inert={!active}
      className="flex w-full shrink-0 snap-start snap-always flex-col py-[clamp(1.75rem,4vw,3rem)] tablet:px-[clamp(1.25rem,3vw,2.75rem)]"
    >
      <figure className="flex flex-1 flex-col">
        {/* who is speaking */}
        <figcaption className="flex items-center gap-4">
          {t.portrait && (
            <span className="w-[clamp(3.25rem,5vw,4.5rem)] shrink-0">
              <TestimonialPortrait portrait={t.portrait} />
            </span>
          )}
          <span className="grid min-w-0 gap-1.5">
            <span className="font-serif text-lede text-ink">
              <span className="sr-only">{demo ? 'A fictional example, attributed to ' : 'Said by '}</span>
              {t.attribution}
            </span>
            <span className="type-meta leading-normal text-ink-soft">
              {[t.context, demo && 'Fictional example'].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span aria-hidden="true" className="ml-auto self-start type-meta text-ink-muted">
            {two(index + 1)}
          </span>
        </figcaption>

        <div
          className={cx(
            'mt-[clamp(1.5rem,3.5vw,2.5rem)] mb-[clamp(1.75rem,4vw,3rem)]',
            artwork &&
              'grid gap-5 tablet:grid-cols-[minmax(0,1fr)_clamp(8rem,16vw,12.5rem)] tablet:gap-[clamp(1.5rem,3.5vw,3rem)]',
          )}
        >
          {/* what they said - the heart of it */}
          <blockquote>
            <svg aria-hidden="true" viewBox="0 0 24 18" className="mb-4 h-4 w-auto fill-burgundy">
              <path d="M0 18v-7.5C0 4.6 3.2 1 9 0l1 2.4C6.6 3.5 5 5.6 5 8.5h4.5V18zm13.5 0v-7.5C13.5 4.6 16.7 1 22.5 0l1 2.4c-3.4 1.1-5 3.2-5 6.1H23V18z" />
            </svg>
            <p className="max-w-[30ch] font-serif text-[clamp(1.4rem,2.5vw,2.3rem)] leading-[1.22] text-ink">{t.quote}</p>
          </blockquote>

          {/* a supporting plate: small, framed, captioned for what it is */}
          {artwork && (
            <figure className="flex items-end gap-4 tablet:block tablet:pt-1">
              <span className="relative block w-19 shrink-0 border border-rule p-1 tablet:w-full">
                <ResponsiveImage image={artwork.image} alt={artwork.alt} ratio="4 / 5" sizes="(min-width: 700px) 200px, 76px" />
                <span aria-hidden="true" className="absolute -top-px -left-px size-2 border-t border-l border-burgundy" />
              </span>
              <figcaption className="type-meta leading-normal text-ink-soft tablet:mt-2.5">{artwork.caption}</figcaption>
            </figure>
          )}
        </div>

        {/* how to hear it - or plainly, that it is written only */}
        <div className="mt-auto border-t border-rule pt-5">
          {t.voice ? (
            <VoiceNote
              audio={t.voice}
              speaker={t.attribution}
              note={'synthetic' in t.voice ? 'Synthetic demo voice — not a real recording' : undefined}
              active={active}
            />
          ) : (
            <p className="flex items-center gap-3 type-meta text-ink-soft">
              <span aria-hidden="true" className="h-px w-6 bg-ink-muted" />
              Written testimonial
            </p>
          )}
        </div>
      </figure>
    </article>
  );
}
