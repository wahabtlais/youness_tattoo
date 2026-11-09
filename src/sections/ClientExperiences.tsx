import { useState } from 'react';
import type { ClientTestimonial, DemoTestimonial } from '../domain/client';
import type { ImageAsset } from '../domain/media';
import { VoiceNote } from '../components/testimonials/VoiceNote';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { useTestimonials } from '../hooks/useTestimonials';
import { useSiteContent } from '../hooks/useSiteContent';
import { useWork } from '../hooks/useWork';
import { cx } from '../lib/cx';

type Testimonial = ClientTestimonial | DemoTestimonial;
interface Artwork {
  image: ImageAsset;
  alt: string;
  caption: string;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Clients' words, as an editorial spread: one quote at a time at headline
 * size, the client's piece pinned beside it as a print, their voice note
 * under it, and the others' names as numbered tabs - the next story is
 * always in view. Changing story crossfades (not under reduced motion);
 * nothing turns by itself.
 *
 * Only genuine testimonials reach the live site: each published one carries
 * its consent (data/clientExperiences.ts, the studio's records). When there
 * are only the fictional demo entries, the section isn't on the site at all
 * - no invented words, no synthetic voice. In development and in the
 * studio's site preview they still show, labelled as a preview, so the
 * layout can be reviewed.
 */
export function ClientExperiences() {
  const work = useWork();
  const { content, preview } = useSiteContent();
  const copy = content.experiences;
  const experiences = useTestimonials();
  const [active, setActive] = useState(0);
  if (experiences.status === 'awaiting') return null;
  const demo = experiences.status === 'demo';
  if (demo && !import.meta.env.DEV && preview === 'off') return null;

  const list = experiences.testimonials as Testimonial[];
  const current = list[Math.min(active, list.length - 1)];
  const artwork = artworkFor(current, work.status === 'success' ? work.data : []);

  return (
    <section id="experiences" aria-labelledby="experiencesHeading" className="bg-paper px-page-x py-[clamp(4.5rem,13vh,8.5rem)]">
      <div className="mx-auto max-w-page">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-ink pb-4">
          <p className="type-meta text-ink-soft">
            <span className="text-burgundy">04</span> · {copy.eyebrow}
          </p>
          {demo && (
            <p className="w-fit border border-burgundy px-3 py-1.5 type-meta leading-normal text-burgundy">
              Preview only — fictional testimonials, hidden on the live site
            </p>
          )}
        </div>

        <div className="mt-[clamp(2.5rem,7vh,4.5rem)] grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-12 desktop:grid-cols-12">
          <div className="desktop:col-span-4">
            <h2 id="experiencesHeading" className="max-w-[12ch] font-serif text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.02] text-balance">
              {copy.heading}
            </h2>
            <p className="mt-5 max-w-[32ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
            {artwork && (
              <figure className="mt-[clamp(2rem,5vh,3rem)] hidden w-[min(100%,17rem)] -rotate-[2.5deg] tablet:block">
                <div key={current.id} className="border border-rule bg-white p-[4%] shadow-[0_18px_36px_-24px_rgb(20_19_26/0.55)] motion-safe:animate-fade-in">
                  <ResponsiveImage image={artwork.image} alt={artwork.alt} ratio="4 / 5" sizes="17rem" />
                </div>
                <figcaption className="mt-3 rotate-[2.5deg] type-meta text-ink-soft">{artwork.caption}</figcaption>
              </figure>
            )}
          </div>

          <div className="min-w-0 desktop:col-span-8">
            <div aria-live="polite">
              <figure key={current.id} className="m-0 motion-safe:animate-fade-in">
                <blockquote className="relative m-0">
                  <span aria-hidden="true" className="absolute -top-[0.18em] -left-[0.05em] font-serif text-[clamp(6rem,11vw,9.5rem)] leading-none text-burgundy desktop:-left-[0.55em]">
                    &ldquo;
                  </span>
                  <p className="relative pt-[clamp(3.5rem,7vw,4.5rem)] font-serif text-[clamp(1.8rem,3.6vw,3.3rem)] leading-[1.12] tracking-[-0.008em] text-balance desktop:pt-0">
                    {current.quote}
                  </p>
                </blockquote>
                <figcaption className="mt-[clamp(1.5rem,4vh,2.25rem)] flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <span className="font-serif text-[1.45rem]">{current.attribution}</span>
                  <span className="type-meta text-ink-soft">
                    {[current.context, 'demo' in current ? 'Fictional example' : null].filter(Boolean).join(' · ')}
                  </span>
                </figcaption>
              </figure>
            </div>

            {current.voice && (
              <div className="mt-[clamp(2rem,5vh,3rem)] border-t border-rule pt-5">
                <VoiceNote
                  key={current.id}
                  audio={current.voice}
                  speaker={current.attribution}
                  note={'synthetic' in current.voice ? 'Synthetic demo voice — not a real recording' : undefined}
                  active
                />
              </div>
            )}

            {list.length > 1 && (
              <div className="mt-[clamp(2rem,5vh,3rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                <ul className="flex flex-wrap gap-x-7 gap-y-2" aria-label="Choose a story">
                  {list.map((t, i) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-pressed={i === active}
                        onClick={() => setActive(i)}
                        className="group inline-flex min-h-11 items-baseline gap-2.5 text-ink-soft transition-colors hover:text-ink aria-pressed:text-ink"
                      >
                        <span className="type-meta group-aria-pressed:text-burgundy">{two(i + 1)}</span>
                        <span className="font-serif text-[1.15rem] underline-offset-[6px] decoration-burgundy group-aria-pressed:underline">{t.attribution}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  {[
                    { label: 'Previous story', to: (active - 1 + list.length) % list.length, glyph: '←' },
                    { label: 'Next story', to: (active + 1) % list.length, glyph: '→' },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      aria-label={b.label}
                      onClick={() => setActive(b.to)}
                      className={cx(
                        'grid size-11 place-items-center rounded-full border border-ink/40 text-ink transition-colors',
                        'hover:border-ink hover:bg-ink hover:text-paper',
                      )}
                    >
                      <span aria-hidden="true">{b.glyph}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** the piece beside a testimonial: the client's own (linked with their consent), or for a demo entry a portfolio sample, captioned as one */
function artworkFor(t: Testimonial, pieces: { id: string; image: ImageAsset; alt: string }[]): Artwork | null {
  const id = 'demo' in t ? t.sampleWorkId : t.workId;
  const piece = id ? pieces.find((w) => w.id === id) : undefined;
  if (!piece) return null;
  return 'demo' in t
    ? { image: piece.image, alt: `${piece.alt}, shown as a sample - not this person's tattoo`, caption: 'Portfolio image — sample, not theirs' }
    : { image: piece.image, alt: piece.alt, caption: `Their piece · ${piece.id}` };
}
