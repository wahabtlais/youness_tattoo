import { Link, useParams } from 'react-router';
import { useConsultation } from '../components/consultation/consultationContext';
import { BackLink, ContentPicture, RelatedWork, StatusTag } from '../components/content/ContentParts';
import { usePieces } from '../hooks/usePieces';
import { Button } from '../components/ui/Button';
import { DemoNotice } from '../components/ui/DemoNotice';
import { NotFound } from '../components/layout/NotFound';
import { callTakesResponses } from '../domain/canvasCall';
import { useCanvasCalls, useJournal } from '../hooks/useContent';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate } from '../lib/date';

/**
 * /canvas-calls/:slug - one call in full, and the next step. An open call
 * opens the existing consultation with the call attached (its slug and
 * title travel with the draft); a call that isn't open offers a general
 * consultation instead, never a dead "apply" button. Nothing is sent
 * anywhere yet - the consultation says so itself.
 */
export function CanvasCallPage() {
  const { slug } = useParams();
  const calls = useCanvasCalls();
  const journal = useJournal();
  const consultation = useConsultation();
  const call = calls.status === 'success' ? (calls.data.items.find((c) => c.slug === slug) ?? null) : null;
  useDocumentTitle(call ? call.title : null); // not found: NotFound titles the tab
  const pieces = usePieces(call?.workIds);

  if (!call) {
    return (
      <NotFound
        title="That call isn’t listed."
        detail="It may have been mistyped, or the call has been taken down."
        links={[
          { to: '/canvas-calls', label: 'See the canvas calls' },
          { to: '/', label: 'Back to the studio' },
        ]}
      />
    );
  }

  const event = call.eventSlug && journal.status === 'success' ? journal.data.items.find((p) => p.slug === call.eventSlug) : undefined;
  const open = callTakesResponses(call);
  const spec = [
    ['Status', <StatusTag key="s" status={call.status} />],
    ['Placement', call.placement],
    ['Scale', call.scale],
    ['Offer', call.offer],
    ['Respond by', call.deadline && formatDate(call.deadline)],
  ].filter((r) => !!r[1]);

  return (
    <article className="mx-auto max-w-page px-page-x pt-[clamp(6.5rem,15vh,9rem)] pb-[clamp(3rem,8vh,5rem)]">
      <BackLink to="/canvas-calls">Canvas calls</BackLink>

      <div className="mt-[clamp(1.5rem,4vh,2.5rem)] grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-10 desktop:grid-cols-12">
        <div className="desktop:col-span-5">
          <ContentPicture picture={call.artwork} sizes="(min-width: 1100px) 38vw, 92vw" demo={call.demo} className="max-w-[30rem]" />
        </div>

        <div className="desktop:col-span-6 desktop:col-start-7">
          <p className="type-eyebrow text-burgundy">Canvas call</p>
          <h1 className="mt-3 max-w-[18ch] font-serif text-[clamp(2.1rem,4.6vw,3.9rem)] leading-[1.03] tracking-[-0.015em]">{call.title}</h1>
          {call.demo && <DemoNotice className="mt-5">Demo content — a fictional call. No real offer, deadline or appointment.</DemoNotice>}

          <div className="mt-6 grid max-w-[60ch] gap-4 text-body leading-copy text-ink-soft">
            {call.description.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <dl className="mt-8 border-t border-ink">
            {spec.map(([k, v]) => (
              <div key={k as string} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                <dt className="type-meta text-ink-muted">{k}</dt>
                <dd className="text-body text-ink">{v}</dd>
              </div>
            ))}
            {call.eligibility && call.eligibility.length > 0 && (
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                <dt className="type-meta text-ink-muted">Conditions</dt>
                <dd>
                  <ul className="grid gap-1 text-body text-ink">
                    {call.eligibility.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {event && (
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                <dt className="type-meta text-ink-muted">Event</dt>
                <dd>
                  <Link to={`/journal/${event.slug}`} className="text-body text-ink underline decoration-burgundy underline-offset-4 hover:text-burgundy">
                    {event.title}
                  </Link>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-8 border-t border-rule pt-6">
            {open ? (
              <>
                <Button variant="primary" onClick={() => consultation.open({ from: 'canvas-call', callSlug: call.slug, title: call.title, demo: call.demo })}>
                  Respond to this call
                </Button>
                <p className="mt-3 max-w-[52ch] text-micro leading-copy text-ink-muted">
                  Opens the consultation with this call attached. Nothing is sent yet — sending it to Younes is still to come.
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-lede text-ink-soft italic">
                  {call.status === 'upcoming'
                    ? 'This call isn’t taking responses yet.'
                    : call.status === 'booked'
                      ? 'This call has been filled.'
                      : 'This call has closed.'}
                </p>
                <Button variant="secondary" className="mt-4" onClick={() => consultation.open({ from: 'book' })}>
                  Start a general consultation
                </Button>
              </>
            )}
          </div>

          <div className="mt-10">
            <RelatedWork pieces={pieces} />
          </div>
        </div>
      </div>
    </article>
  );
}
