import { Button } from '../components/ui/Button';
import type { TattooWork } from '../domain/work';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { useInView } from '../hooks/useInView';
import { useSiteContent } from '../hooks/useSiteContent';
import { usePieces } from '../hooks/usePieces';
import { cx } from '../lib/cx';

/**
 * The close of the page, its own chapter on the bright paper-light stock:
 * two of Younes's real pieces mounted as overlapping prints - in front, a
 * tattoo being made (02); behind it, a finished one (01) - beside the
 * invitation, which a single burgundy line, like a needle's stroke,
 * underscores. The line draws itself once, slowly, as the section comes
 * into view; under reduced motion it is simply there. No logo or address
 * here: the masthead and the footer carry those.
 */
export function Book({ onOpen }: { onOpen: () => void }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const copy = useSiteContent().content.book;
  const [front, back] = usePieces(['02', '01']);

  return (
    <section id="book" aria-labelledby="bookHeading" className="relative overflow-x-clip bg-paper-light px-page-x py-[clamp(5rem,14vh,9rem)]">
      <div ref={ref} data-in={inView} className="group/book mx-auto grid max-w-page items-center gap-x-[clamp(2rem,6vw,6rem)] gap-y-[clamp(3rem,8vh,4.5rem)] desktop:grid-cols-12">
        {front && (
          <figure className="relative mx-auto w-full max-w-[24rem] desktop:col-span-5 desktop:col-start-1 desktop:max-w-none">
            <div className="relative aspect-[4/4.6]">
              {back && (
                <Print
                  piece={back}
                  className="absolute top-0 left-0 w-[62%] -rotate-[5deg] motion-safe:transition-[rotate,translate] motion-safe:duration-[1.6s] motion-safe:ease-editorial motion-safe:group-data-[in=false]/book:-translate-x-3 motion-safe:group-data-[in=false]/book:-rotate-[2deg]"
                />
              )}
              <Print
                piece={front}
                className="absolute right-0 bottom-0 w-[72%] rotate-[2.5deg] motion-safe:transition-[rotate,translate] motion-safe:duration-[1.6s] motion-safe:ease-editorial motion-safe:group-data-[in=false]/book:translate-y-3 motion-safe:group-data-[in=false]/book:rotate-0"
              />
            </div>
            <figcaption className="mt-5 type-meta text-ink-soft">
              From the portfolio · {front.id}
              {back && ` & ${back.id}`}
            </figcaption>
          </figure>
        )}

        <div className={cx('desktop:col-span-6 desktop:col-start-7', !front && 'desktop:col-start-4 desktop:text-center')}>
          <p className="type-eyebrow text-burgundy">Your idea</p>
          <h2 id="bookHeading" className="mt-5 max-w-[12ch] type-heading text-[clamp(2.6rem,6vw,5rem)] leading-[0.98]">
            Ready to make it{' '}
            <span className="relative inline-block">
              yours?
              {/* the line: one stroke, drawn once as the section arrives */}
              <svg
                aria-hidden="true"
                viewBox="0 0 300 28"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -bottom-[0.32em] left-[-4%] h-[0.32em] w-[108%] overflow-visible"
              >
                <path
                  d="M4 18 C 52 6, 104 26, 158 15 S 252 3, 296 13"
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="text-burgundy [stroke-dasharray:1] motion-safe:transition-[stroke-dashoffset] motion-safe:delay-300 motion-safe:duration-[2.4s] motion-safe:ease-editorial motion-safe:group-data-[in=false]/book:[stroke-dashoffset:1] motion-safe:group-data-[in=true]/book:[stroke-dashoffset:0]"
                />
              </svg>
            </span>
          </h2>
          <p className="mt-[clamp(1.75rem,4vh,2.5rem)] max-w-[36ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
          <Button variant="primary" className="mt-8" onClick={onOpen}>
            Start a consultation
          </Button>
        </div>
      </div>
    </section>
  );
}

/** a portfolio photograph mounted like the archive's prints: a paper border and a hairline */
function Print({ piece, className }: { piece: TattooWork; className?: string }) {
  return (
    <div className={cx('border border-rule bg-white p-[3.5%]', className)}>
      <ResponsiveImage image={piece.image} alt={piece.alt} ratio="4 / 5" sizes="(min-width: 1100px) 28vw, 70vw" loading="lazy" />
    </div>
  );
}
