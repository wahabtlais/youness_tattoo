import { Link } from 'react-router';
import { ContentPicture } from '../components/content/ContentParts';
import { ButtonLink } from '../components/ui/ButtonLink';
import { DemoNotice } from '../components/ui/DemoNotice';
import type { CanvasCall } from '../domain/canvasCall';
import { useCanvasCalls } from '../hooks/useContent';
import { useSiteContent } from '../hooks/useSiteContent';
import { cx } from '../lib/cx';
import { formatDate } from '../lib/date';

const two = (n: number) => String(n).padStart(2, '0');
/** each poster hangs a little differently on the wall */
const TILT = ['-rotate-[1.4deg]', 'rotate-[1deg]', '-rotate-[0.6deg]'];

/**
 * Open Canvas Calls on the home page - opportunities, not news - as posters
 * pinned to the studio's wall (the warm kraft stock, paper-toned): each a
 * printed open call with its number, the piece Younes wants to tattoo, its
 * particulars and a stamped "respond by". They hang a little askew and
 * straighten when you reach for one (pointer or keyboard focus). The whole
 * poster is the link to the call. Only calls open today are shown; with
 * none open, the section isn't there.
 */
export function CanvasCallsPreview() {
  const calls = useCanvasCalls();
  const copy = useSiteContent().content.canvasCalls;
  if (calls.status !== 'success') return null;
  const { items, demo } = calls.data;
  const open = items.filter((c) => c.status === 'open').slice(0, 3);
  if (open.length === 0) return null;

  return (
    <section id="canvas-calls" aria-labelledby="callsHeading" className="relative bg-paper-toned px-page-x py-[clamp(4.5rem,12vh,8rem)]">
      {/* the wall's own grain */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-multiply [background-image:var(--texture-grain)]" />
      <div className="relative mx-auto max-w-page">
        <header className="grid gap-x-[clamp(2rem,6vw,5rem)] gap-y-5 desktop:grid-cols-12 desktop:items-end">
          <div className="desktop:col-span-7">
            <p className="type-meta text-ink-soft">
              <span className="text-burgundy">07</span> · Canvas calls · <span className="text-ink">{two(open.length)} open</span>
            </p>
            <h2 id="callsHeading" className="mt-4 max-w-[13ch] font-serif text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[0.98] tracking-[-0.015em] text-balance">
              {copy.heading}
            </h2>
          </div>
          <div className="grid gap-4 desktop:col-span-5">
            <p className="max-w-[40ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
            {demo && <DemoNotice>Demo content — fictional calls. No offer or deadline here is real.</DemoNotice>}
          </div>
        </header>

        {/* however many are open, they hang centred on the wall */}
        <ul className="mt-[clamp(3rem,8vh,5rem)] flex flex-wrap justify-center gap-x-[clamp(1.5rem,3.5vw,3.25rem)] gap-y-14">
          {open.map((c, i) => (
            <li key={c.slug} className="w-full max-w-[23rem] tablet:w-[calc(50%-1.75rem)] desktop:w-[calc(33.333%-2.2rem)]">
              <Poster call={c} number={i + 1} tilt={TILT[i % TILT.length]} />
            </li>
          ))}
        </ul>

        <div className="mt-[clamp(3rem,8vh,4.5rem)] flex justify-center">
          <ButtonLink to="/canvas-calls" arrow>
            All canvas calls
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Poster({ call: c, number, tilt }: { call: CanvasCall; number: number; tilt: string }) {
  const facts = [c.placement, c.scale].filter(Boolean).join(' · ');
  return (
    <article
      className={cx(
        'group relative bg-paper-light p-[clamp(1rem,2vw,1.35rem)] shadow-[0_22px_40px_-28px_rgb(20_19_26/0.6)] ring-1 ring-ink/10',
        tilt,
        'motion-safe:transition-[rotate,translate,box-shadow] motion-safe:duration-(--duration-normal) motion-safe:ease-editorial',
        'hover:rotate-0 hover:-translate-y-1 focus-within:rotate-0 focus-within:-translate-y-1 motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0',
      )}
    >
      {/* tape holding it to the wall */}
      <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-2 bg-[rgb(232_224_205/0.85)] shadow-[0_1px_2px_rgb(20_19_26/0.15)]" />
      <p className="flex items-baseline justify-between border-b-2 border-ink pb-2 type-meta text-ink">
        <span>Open call</span>
        <span aria-hidden="true">No. {two(number)}</span>
      </p>
      <ContentPicture picture={c.artwork} ratio="4 / 5" sizes="(min-width: 1100px) 22rem, (min-width: 700px) 42vw, 90vw" demo={c.demo} className="mt-4 [&_figcaption]:hidden" />
      <h3 className="mt-5 font-serif text-[clamp(1.6rem,2.4vw,2.05rem)] leading-[1.06] text-balance">
        {/* the title's link covers the whole poster */}
        <Link to={`/canvas-calls/${c.slug}`} className="after:absolute after:inset-0 group-hover:text-burgundy">
          {c.title}
        </Link>
      </h3>
      {facts && <p className="mt-3 type-meta leading-normal text-ink-soft">{facts}</p>}
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-ink/20 pt-4">
        {/* the stamp */}
        <p className="-rotate-[3deg] border-2 border-burgundy px-2.5 py-1.5 type-meta leading-tight text-burgundy">
          {c.deadline ? (
            <>
              Respond by
              <br />
              {formatDate(c.deadline)}
            </>
          ) : (
            'No deadline'
          )}
        </p>
        <span aria-hidden="true" className="inline-flex items-center gap-2 type-label text-ink group-hover:text-burgundy">
          Respond <span className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
        </span>
      </div>
      {c.demo && <DemoNotice inline className="mt-3 block" />}
    </article>
  );
}
