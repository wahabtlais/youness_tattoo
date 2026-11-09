import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import type { TattooWork } from '../domain/work';
import { usePieces } from '../hooks/usePieces';
import { useSiteContent } from '../hooks/useSiteContent';
import { cx } from '../lib/cx';
import './Process.css';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The way from an idea to a session, as a guided journey - its own chapter
 * on the heavier paper stock (paper-deep).
 *
 * Wide screens: a rail stays in view beside the stages - the current
 * stage's large number, its title, and the four stages as links (where you
 * are, and a way to any of them) - while the stages pass. A stitched line
 * runs through them; it fills, stage by stage, as each reaches the middle
 * of the screen. Narrower screens: each stage carries its own number; the
 * line runs down beside them.
 *
 * Each stage has its own object - what that moment of the process looks
 * like - all real or honestly labelled:
 *   01 the consultation's first question, on an index card
 *   02 pieces from the archive pinned together (Find Similar, the real feature)
 *   03 a placement drawing - an illustration, labelled as one
 *   04 his own photograph of a tattoo being made (portfolio 02)
 * Photographs of the earlier stages (a sketch, a stencil being placed) are
 * on Younes's content list; the drawn objects stand in honestly until then.
 *
 * Words: the site's content (data/siteContent.ts, data/process.ts), as the
 * dashboard edits them. Reduced motion: nothing animates; the current stage
 * still updates. It ends by opening the consultation (`onStart`).
 */
export function Process({ onStart }: { onStart: () => void }) {
  const copy = useSiteContent().content.process;
  const steps = copy.steps;
  const [active, setActive] = useState(0);
  const stageRefs = useRef<(HTMLLIElement | null)[]>([]);
  const refs = usePieces(['04', '05', '08']);
  const [session] = usePieces(['02']);

  // the stage crossing the middle of the screen is the current one (one
  // state change per stage, not per scroll frame)
  useEffect(() => {
    const els = stageRefs.current.filter((el): el is HTMLLIElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.stage));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  const visuals: ReactNode[] = [
    <IdeaCard key="idea" />,
    <PinnedReferences key="refs" pieces={refs} />,
    <PlacementDrawing key="placement" />,
    <SessionPrint key="session" piece={session} />,
  ];
  const progress = steps.length > 1 ? active / (steps.length - 1) : 1;

  return (
    <section id="process" aria-labelledby="processHeading" className="bg-paper-deep px-page-x py-[clamp(4.5rem,13vh,8.5rem)]">
      <div className="mx-auto max-w-page">
        <header className="grid gap-x-[clamp(2rem,6vw,5rem)] gap-y-6 desktop:grid-cols-12 desktop:items-end">
          <div className="desktop:col-span-8">
            <p className="type-meta text-ink-soft">
              <span className="text-burgundy">05</span> · {copy.eyebrow}
            </p>
            <h2 id="processHeading" className="mt-5 max-w-[15ch] font-serif text-[clamp(2.5rem,6.4vw,5.6rem)] leading-[0.98] tracking-[-0.018em] text-balance">
              {copy.heading}
            </h2>
          </div>
          <p className="max-w-[40ch] text-body leading-copy text-ink-soft desktop:col-span-4 desktop:pb-3">{copy.intro}</p>
        </header>

        <div className="mt-[clamp(3.5rem,10vh,6.5rem)] desktop:grid desktop:grid-cols-[minmax(15rem,0.32fr)_minmax(0,1fr)] desktop:gap-x-[clamp(3rem,6vw,6rem)]">
          {/* the rail: stays in view while the stages pass (wide screens) */}
          <nav aria-label="Process stages" className="hidden desktop:block">
            <div className="sticky top-[clamp(5.5rem,14vh,8rem)]">
              <p aria-hidden="true" className="relative h-[clamp(9rem,15vw,13rem)] overflow-hidden">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={cx(
                      'absolute inset-x-0 top-0 font-serif text-[clamp(9rem,15vw,13rem)] leading-[0.82] tracking-[-0.04em] text-burgundy',
                      'motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-slow) motion-safe:ease-editorial',
                      i === active ? 'opacity-100' : 'pointer-events-none opacity-0',
                      i < active && 'motion-safe:-translate-y-6',
                      i > active && 'motion-safe:translate-y-6',
                    )}
                  >
                    {two(i + 1)}
                  </span>
                ))}
              </p>
              <p className="mt-4 type-meta text-ink-soft" aria-hidden="true">
                Stage {two(active + 1)} of {two(steps.length)}
              </p>
              <ol className="mt-7 border-t border-ink/20">
                {steps.map((s, i) => (
                  <li key={s.title} className="border-b border-ink/20">
                    <a
                      href={`#process-stage-${i + 1}`}
                      aria-current={i === active ? 'step' : undefined}
                      className="group flex min-h-11 items-baseline gap-4 py-3 text-ink-soft transition-colors hover:text-ink aria-[current=step]:text-ink"
                    >
                      <span className="type-meta group-aria-[current=step]:text-burgundy">{two(i + 1)}</span>
                      <span className="font-serif text-[1.15rem] leading-snug">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          {/* the stages, stitched together */}
          <div className="process-journey relative" style={{ '--progress': progress } as CSSProperties}>
            <span aria-hidden="true" className="process-stitch" />
            <span aria-hidden="true" className="process-stitch process-stitch--done" />
            <ol className="grid gap-y-[clamp(4.5rem,13vh,8rem)]">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  id={`process-stage-${i + 1}`}
                  data-stage={i}
                  ref={(el) => {
                    stageRefs.current[i] = el;
                  }}
                  className="process-stage relative scroll-mt-28 pl-[clamp(2.75rem,6vw,4.5rem)]"
                  data-current={i === active}
                  data-passed={i < active}
                >
                  <span aria-hidden="true" className="process-mark" />
                  <div className="grid gap-x-[clamp(2rem,4.5vw,4.5rem)] gap-y-8 tablet:grid-cols-2 tablet:items-center">
                    <div>
                      {/* the number on its own stage: the narrower layouts' only one */}
                      <p aria-hidden="true" className="font-serif text-[clamp(4.2rem,14vw,6rem)] leading-[0.8] tracking-[-0.03em] text-burgundy desktop:hidden">
                        {two(i + 1)}
                      </p>
                      <p className="mt-4 type-meta text-burgundy desktop:mt-0">
                        <span className="sr-only">Stage </span>
                        {two(i + 1)} <span aria-hidden="true">/</span>
                        <span className="sr-only"> of</span> {two(steps.length)}
                      </p>
                      <h3 className="mt-3 max-w-[16ch] font-serif text-[clamp(2rem,3.4vw,3rem)] leading-[1.04] text-balance">{s.title}</h3>
                      <p className="mt-4 max-w-[38ch] text-body leading-copy text-ink-soft">{s.body}</p>
                    </div>
                    <div className="process-visual">{visuals[i] ?? null}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-[clamp(4rem,11vh,7rem)] flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-t border-ink pt-[clamp(1.5rem,4vh,2.25rem)]">
          <p className="max-w-[22ch] font-serif text-[clamp(1.8rem,3.6vw,3rem)] leading-[1.05] italic">{copy.closing}</p>
          <Button variant="primary" onClick={onStart}>
            Start a consultation
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 01 - the consultation's own first question, on a ruled index card */
function IdeaCard() {
  return (
    <figure className="m-0">
      <div className="process-card relative mx-auto max-w-[26rem] -rotate-[1.5deg] px-[clamp(1.25rem,3vw,2rem)] pt-[clamp(1.25rem,3vw,1.75rem)] pb-[clamp(3.5rem,8vw,5rem)]">
        <p className="type-meta text-ink-soft">Your idea</p>
        <p className="mt-4 font-serif text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] italic">What would you like to get tattooed?</p>
        <p className="mt-3 text-micro leading-copy text-ink-soft">In your own words – a sentence is enough.</p>
      </div>
      <figcaption className="mt-5 text-center type-meta text-ink-soft">The consultation’s first question</figcaption>
    </figure>
  );
}

/** 02 - pieces from the archive, pinned together the way Find Similar gathers them */
function PinnedReferences({ pieces }: { pieces: TattooWork[] }) {
  const placed = [
    'left-0 top-[8%] w-[38%] -rotate-[5deg]',
    'left-[30%] top-0 z-10 w-[40%] rotate-[2deg]',
    'right-0 top-[12%] w-[34%] rotate-[6deg]',
  ];
  return (
    <figure className="m-0">
      <div className="relative mx-auto aspect-[16/10] max-w-[30rem]">
        {pieces.slice(0, 3).map((p, i) => (
          <div key={p.id} className={cx('process-pin absolute border border-rule bg-white p-[3%]', placed[i])}>
            <ResponsiveImage image={p.image} alt={p.alt} ratio="4 / 5" sizes="(min-width: 1100px) 12vw, 30vw" />
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-center type-meta text-ink-soft">
        Find Similar · pieces {pieces.map((p) => p.id).join(', ')} from the archive
      </figcaption>
    </figure>
  );
}

/** 03 - placement and size, drawn: an illustration, not a client's piece */
function PlacementDrawing() {
  return (
    <figure className="m-0">
      <div className="process-sheet mx-auto max-w-[30rem] p-[clamp(1rem,2.5vw,1.5rem)]">
        <svg viewBox="0 0 440 300" role="img" aria-label="An illustration: a forearm outline with a dashed area marking where a design would sit, and a measured size line." className="block h-auto w-full text-ink">
          <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            {/* the forearm, wrist to elbow */}
            <path d="M28 118 C 110 96, 250 92, 412 108" strokeOpacity=".55" />
            <path d="M28 196 C 120 214, 260 220, 412 204" strokeOpacity=".55" />
            <path d="M28 118 C 16 140, 16 176, 28 196" strokeOpacity=".35" />
            <path d="M412 108 C 426 130, 426 182, 412 204" strokeOpacity=".2" strokeDasharray="3 5" />
            {/* where the piece would sit */}
            <rect x="168" y="118" width="150" height="80" className="text-burgundy" stroke="currentColor" strokeDasharray="6 5" />
            <path d="M168 238 H318 M168 231 V245 M318 231 V245" className="text-burgundy" stroke="currentColor" />
            <path d="M342 118 V198 M335 118 H349 M335 198 H349" className="text-burgundy" stroke="currentColor" />
          </g>
          <g fill="currentColor" fontFamily="DM Mono, monospace" fontSize="13" letterSpacing="2.5">
            <text x="28" y="64" fillOpacity=".8">PLACEMENT</text>
            <text x="222" y="266" className="text-burgundy" fill="currentColor">SIZE</text>
            <text x="28" y="290" fillOpacity=".7">DRAWN FOR EACH PIECE</text>
          </g>
        </svg>
      </div>
      <figcaption className="mt-5 text-center type-meta text-ink-soft">Illustration · placement and size are agreed together</figcaption>
    </figure>
  );
}

/** 04 - his own photograph of a session, mounted as a print */
function SessionPrint({ piece }: { piece?: TattooWork }) {
  if (!piece) return null;
  return (
    <figure className="m-0">
      <div className="mx-auto max-w-[24rem] rotate-[1.5deg] border border-rule bg-white p-[3.5%] shadow-[0_18px_40px_-26px_rgb(20_19_26/0.55)]">
        <ResponsiveImage image={piece.image} alt={piece.alt} ratio="4 / 5" sizes="(min-width: 1100px) 22vw, 70vw" />
      </div>
      <figcaption className="mt-5 text-center type-meta text-ink-soft">From the portfolio · {piece.id}</figcaption>
    </figure>
  );
}
