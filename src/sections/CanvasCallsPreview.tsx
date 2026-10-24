import { Link } from 'react-router';
import { ContentPicture, StatusTag } from '../components/content/ContentParts';
import { ButtonLink } from '../components/ui/ButtonLink';
import { DemoNotice } from '../components/ui/DemoNotice';
import { Reveal } from '../components/ui/Reveal';
import type { CanvasCall } from '../domain/canvasCall';
import { useCanvasCalls } from '../hooks/useContent';
import { useSiteContent } from '../hooks/useSiteContent';
import { formatDate } from '../lib/date';

/**
 * Open Canvas Calls on the home page - opportunities, not news, so set
 * apart from the Journal: a warm kraft-like stock (paper-toned) under a
 * burgundy rule, and the calls as a ledger, one row each - status and
 * deadline first, then what the piece is, its particulars, and the way to
 * respond. Only calls open today are shown (a passed deadline closes a call
 * at the data boundary); with none open, the section isn't there.
 */
export function CanvasCallsPreview() {
  const calls = useCanvasCalls();
  const copy = useSiteContent().content.canvasCalls;
  if (calls.status !== 'success') return null;
  const { items, demo } = calls.data;
  const open = items.filter((c) => c.status === 'open').slice(0, 3);
  if (open.length === 0) return null;

  return (
    <section id="canvas-calls" aria-labelledby="callsHeading" className="border-t-2 border-burgundy bg-paper-toned px-page-x py-[clamp(4rem,11vh,7rem)]">
      <Reveal className="mx-auto grid max-w-page gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 desktop:grid-cols-12">
        <header className="desktop:col-span-4">
          <p className="type-eyebrow text-burgundy">
            Canvas calls · <span className="text-ink">{String(open.length).padStart(2, '0')} open</span>
          </p>
          <h2 id="callsHeading" className="mt-4 max-w-[14ch] type-heading text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02]">
            {copy.heading}
          </h2>
          <p className="mt-5 max-w-[34ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
          {demo && <DemoNotice className="mt-5">Demo content — fictional calls. No offer or deadline here is real.</DemoNotice>}
          {/* the way to the whole list: a framed button, full ink, so it reads at a glance */}
          <ButtonLink to="/canvas-calls" arrow className="mt-7">
            All canvas calls
          </ButtonLink>
        </header>

        <ul className="border-t border-ink desktop:col-span-8">
          {open.map((c) => (
            <li key={c.slug} className="border-b border-ink/20">
              <CallRow call={c} />
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

function CallRow({ call: c }: { call: CanvasCall }) {
  const facts = [c.placement, c.scale].filter(Boolean).join(' · ');
  return (
    <article className="group relative grid grid-cols-[clamp(4.5rem,9vw,6.5rem)_minmax(0,1fr)] gap-x-[clamp(1rem,2.5vw,2rem)] gap-y-3 py-[clamp(1.25rem,3vh,1.75rem)] tablet:grid-cols-[clamp(4.5rem,9vw,6.5rem)_minmax(0,1fr)_auto]">
      <ContentPicture picture={c.artwork} ratio="4 / 5" sizes="104px" demo={c.demo} className="row-span-2 [&_figcaption]:hidden tablet:row-span-1" />
      <div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusTag status={c.status} />
          <span className="type-meta text-ink">{c.deadline ? `Respond by ${formatDate(c.deadline)}` : 'No deadline'}</span>
        </p>
        <h3 className="mt-2.5 max-w-[26ch] font-serif text-[clamp(1.35rem,2vw,1.75rem)] leading-[1.12]">
          {/* the title's link covers the whole row */}
          <Link to={`/canvas-calls/${c.slug}`} className="after:absolute after:inset-0 group-hover:text-burgundy">
            {c.title}
          </Link>
        </h3>
        <p className="mt-2 max-w-[48ch] text-body leading-copy text-ink-soft">{c.summary}</p>
        {facts && <p className="mt-2 type-meta leading-normal text-ink-soft">{facts}</p>}
        {c.demo && <DemoNotice inline className="mt-2 block" />}
      </div>
      <span aria-hidden="true" className="col-start-2 inline-flex items-center gap-2.5 self-end type-label text-ink transition-colors group-hover:text-burgundy tablet:col-start-3 tablet:self-center">
        Read the call and respond <span className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
      </span>
    </article>
  );
}
