import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';

/** The close of the page: the studio's mark like a stamp, and the way in. */
export function Book({ onOpen }: { onOpen: () => void }) {
  return (
    <section
      id="book"
      aria-labelledby="bookHeading"
      className="relative flex min-h-[60vh] items-center justify-center bg-paper px-page-x py-[clamp(6rem,18vh,11rem)] text-center"
    >
      <Reveal className="max-w-measure">
        <img
          className="mx-auto mb-[clamp(2.2rem,5vh,3.2rem)] block h-auto w-[clamp(190px,22vw,290px)]"
          src="/youness_tattoo_logo-640.webp"
          width={2129}
          height={739}
          alt="Younes Tattoo"
          loading="lazy"
          decoding="async"
        />
        <p className="mb-3.5 type-eyebrow text-burgundy">Your idea</p>
        <h2 id="bookHeading" className="mt-3 mb-4 type-heading text-headline">
          Ready to make it yours?
        </h2>
        <p className="mb-9 text-body text-ink-soft">Tell me what you're thinking — we'll take it from there.</p>
        <Button onClick={onOpen}>Start a consultation</Button>
        <p className="mt-10 type-meta text-ink-muted">Detroit, Michigan · by appointment</p>
      </Reveal>
    </section>
  );
}
