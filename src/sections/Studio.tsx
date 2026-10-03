import geometric from '../assets/placeholders/geometric.svg';
import { Reveal } from '../components/ui/Reveal';
import { STUDIO_COPY } from '../data/studio';

/**
 * Editorial introduction to the artist. No biography exists yet, so
 * STUDIO_COPY carries only what's safe to say. The visual is an abstract
 * placeholder, not a stand-in photo - it doesn't pretend to be Younes.
 */
export function Studio() {
  return (
    <section id="studio" aria-labelledby="studioHeading" className="relative bg-white px-page-x py-section">
      <Reveal className="mx-auto grid max-w-page items-center gap-[clamp(2.5rem,6vw,4rem)] desktop:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3.5 type-eyebrow text-burgundy">{STUDIO_COPY.kicker}</p>
          <h2 id="studioHeading" className="mt-2.5 mb-6 type-heading text-headline">
            {STUDIO_COPY.name}
            <span className="mt-2.5 block type-label text-ink-muted">{STUDIO_COPY.role}</span>
          </h2>
          <p className="max-w-[30ch] font-serif text-quote text-ink-soft italic">&ldquo;{STUDIO_COPY.statement}&rdquo;</p>
        </div>

        <div
          aria-hidden="true"
          className="relative flex aspect-3/4 items-center justify-center border border-rule bg-paper p-[12%]"
        >
          <img src={geometric} alt="" className="size-[70%] opacity-70" />
          <span className="absolute inset-x-0 bottom-3 text-center font-mono text-micro tracking-widest text-ink-muted">
            Placeholder — studio visual to come
          </span>
        </div>
      </Reveal>
    </section>
  );
}
