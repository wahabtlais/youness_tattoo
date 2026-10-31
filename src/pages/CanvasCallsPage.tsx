import { Link } from 'react-router';
import { ContentPicture, StatusTag } from '../components/content/ContentParts';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/ui/DemoNotice';
import { StateMessage } from '../components/ui/StateMessage';
import { byCallStatus, type CanvasCall } from '../domain/canvasCall';
import { useCanvasCalls } from '../hooks/useContent';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate } from '../lib/date';

/**
 * /canvas-calls - specific tattoos Younes wants to do. Open and upcoming
 * calls are set large, each like a plate with its particulars; filled and
 * closed ones follow as a quiet list, so their event and work stay findable.
 */
export function CanvasCallsPage() {
  useDocumentTitle('Canvas calls');
  const calls = useCanvasCalls();
  if (calls.status !== 'success') {
    return <StateMessage kind={calls.status === 'loading' ? 'loading' : 'error'} title="The calls could not be loaded." className="min-h-svh justify-center px-page-x" />;
  }
  const { items, demo } = calls.data;
  const sorted = [...items].sort(byCallStatus);
  const live = sorted.filter((c) => c.status === 'open' || c.status === 'upcoming');
  const past = sorted.filter((c) => c.status === 'booked' || c.status === 'closed');

  return (
    <>
      <PageHeader
        eyebrow="/ Canvas calls"
        title="Canvas calls"
        intro={
          <p>
            Particular pieces Younes would like to tattoo, looking for the person to wear them. Each call says what is
            decided and what is still open. Answering one starts a consultation with the call attached.
          </p>
        }
        aside={demo && <DemoNotice>Demo content — fictional calls. No offer, deadline or appointment here is real.</DemoNotice>}
      />

      <div className="mx-auto max-w-page px-page-x pb-[clamp(3rem,8vh,5rem)]">
        {items.length === 0 && <StateMessage kind="empty" title="There are no open calls right now." className="py-16" />}

        {live.length > 0 && (
          <ol className="pt-[clamp(1rem,3vh,2rem)]">
            {live.map((c, i) => (
              <li key={c.slug}>
                <CallPlate call={c} index={i} />
              </li>
            ))}
          </ol>
        )}

        {past.length > 0 && (
          <section aria-label="Past calls" className="pt-[clamp(3rem,8vh,5rem)]">
            <h2 className="mb-4 border-b border-ink pb-2 type-eyebrow text-ink">
              Filled &amp; closed <span className="text-ink-muted">{String(past.length).padStart(2, '0')}</span>
            </h2>
            <ul>
              {past.map((c) => (
                <li key={c.slug} className="grid items-baseline gap-x-6 gap-y-1 border-t border-rule py-3.5 first:border-t-0 tablet:grid-cols-[10rem_minmax(0,1fr)_auto]">
                  <StatusTag status={c.status} />
                  <Link to={`/canvas-calls/${c.slug}`} className="font-serif text-lede text-ink-soft hover:text-burgundy">
                    {c.title}
                  </Link>
                  {c.demo && <DemoNotice inline />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/** one live call: its picture beside the call, the particulars ruled like a spec sheet */
function CallPlate({ call: c, index }: { call: CanvasCall; index: number }) {
  const spec = [
    ['Placement', c.placement],
    ['Scale', c.scale],
    ['Offer', c.offer],
    ['Respond by', c.deadline && formatDate(c.deadline)],
  ].filter((r): r is [string, string] => !!r[1]);
  return (
    <article className="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 border-t border-rule py-[clamp(2rem,5vh,3.5rem)] first:border-t-0 tablet:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] desktop:grid-cols-12">
      <Link to={`/canvas-calls/${c.slug}`} tabIndex={-1} aria-hidden="true" className="desktop:col-span-4">
        <ContentPicture picture={c.artwork} ratio="4 / 5" sizes="(min-width: 1100px) 30vw, (min-width: 700px) 38vw, 92vw" demo={c.demo} />
      </Link>
      <div className="desktop:col-span-7 desktop:col-start-6">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="type-meta text-ink-muted">/ {String(index + 1).padStart(2, '0')}</span>
          <StatusTag status={c.status} />
          {c.demo && <DemoNotice inline />}
        </p>
        <h2 className="mt-3 max-w-[22ch] font-serif text-[clamp(1.7rem,3.2vw,2.8rem)] leading-[1.06]">
          <Link to={`/canvas-calls/${c.slug}`} className="hover:text-burgundy">
            {c.title}
          </Link>
        </h2>
        <p className="mt-3 max-w-[52ch] text-body leading-copy text-ink-soft">{c.summary}</p>
        {spec.length > 0 && (
          <dl className="mt-6 max-w-[34rem] border-t border-ink">
            {spec.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                <dt className="type-meta text-ink-muted">{k}</dt>
                <dd className="text-body text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <Link to={`/canvas-calls/${c.slug}`} className="group mt-6 inline-flex min-h-11 items-center gap-4 type-label text-ink">
          <span aria-hidden="true" className="h-px w-[2.4em] origin-right bg-burgundy transition-[scale] duration-(--duration-slow) ease-editorial group-hover:scale-x-160 motion-reduce:transition-none" />
          {c.status === 'open' ? 'Read the call and respond' : 'Read the call'}
        </Link>
      </div>
    </article>
  );
}
