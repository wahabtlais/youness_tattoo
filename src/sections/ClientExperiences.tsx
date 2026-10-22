import { TestimonialCarousel, type TestimonialArtwork } from '../components/testimonials/TestimonialCarousel';
import { Reveal } from '../components/ui/Reveal';
import { CLIENT_EXPERIENCES } from '../data/clientExperiences';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useWork } from '../hooks/useWork';

/**
 * Clients' words, after the artist and before the way in: the introduction
 * beside a carousel of testimonials, each complete in place - portrait,
 * name, the words, and its voice note when there is one
 * (components/testimonials).
 *
 * Content and its rules are in data/clientExperiences.ts: 'published'
 * testimonials each carry their consent; 'demo' entries are fictional and
 * say so - under the heading and on every entry, with their placeholder
 * portraits and synthetic voices marked as such; 'awaiting' renders nothing.
 */
export function ClientExperiences() {
  const reducedMotion = useReducedMotion();
  const work = useWork();
  if (CLIENT_EXPERIENCES.status === 'awaiting') return null;
  const demo = CLIENT_EXPERIENCES.status === 'demo';

  // the piece beside a testimonial: a client's own (linked with their
  // consent), or for a demo entry a portfolio sample, captioned as one
  const artwork: Record<string, TestimonialArtwork> = {};
  for (const t of CLIENT_EXPERIENCES.testimonials) {
    const id = 'demo' in t ? t.sampleWorkId : t.workId;
    const piece = id && work.status === 'success' ? work.data.find((w) => w.id === id) : undefined;
    if (!piece) continue;
    artwork[t.id] =
      'demo' in t
        ? { image: piece.image, alt: `${piece.alt}, shown as a sample - not this person's tattoo`, caption: 'Portfolio image — demo' }
        : { image: piece.image, alt: piece.alt, caption: `The piece · ${piece.id}` };
  }

  return (
    <section
      id="experiences"
      aria-labelledby="experiencesHeading"
      aria-describedby={demo ? 'experiencesDemo' : undefined}
      // Book, next, opens with its own wide margin
      className="bg-paper px-page-x pt-[clamp(2.5rem,6vh,4rem)] pb-[clamp(1.5rem,4vh,2.5rem)]"
    >
      <Reveal className="mx-auto grid max-w-page gap-y-[clamp(2.25rem,6vh,3.5rem)] border-t border-rule pt-[clamp(3rem,9vh,6.5rem)] desktop:grid-cols-12 desktop:gap-x-[clamp(2rem,4vw,4rem)]">
        <div className="grid gap-x-[clamp(2rem,6vw,5rem)] gap-y-5 tablet:grid-cols-2 tablet:items-end desktop:col-span-4 desktop:grid-cols-1 desktop:content-start desktop:items-start">
          <header>
            <p className="type-eyebrow text-burgundy">Client experiences</p>
            <h2 id="experiencesHeading" className="mt-4 max-w-[16ch] type-heading text-headline">
              More than the finished piece.
            </h2>
          </header>
          <div className="desktop:mt-4">
            <p className="max-w-[34ch] text-body leading-copy text-ink-soft">
              Stories about the ideas, conversations, and decisions behind a tattoo.
            </p>
            {demo && (
              <p
                id="experiencesDemo"
                className="mt-4 inline-block border border-burgundy px-3 py-2 type-meta leading-normal text-burgundy"
              >
                Demo content — fictional testimonials
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 desktop:col-span-8 desktop:col-start-5">
          <TestimonialCarousel testimonials={CLIENT_EXPERIENCES.testimonials} artwork={artwork} reducedMotion={reducedMotion} />
        </div>
      </Reveal>
    </section>
  );
}
