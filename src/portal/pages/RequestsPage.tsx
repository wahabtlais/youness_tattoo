import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PRIVACY_NOTICE_VERSION } from '@younes/contracts';
import { clientApi, ClientApiError, errorText } from '../../client/api';
import { useConsultation } from '../../components/consultation/consultationContext';
import { PrivacyNotice } from '../../components/consultation/PrivacyNotice';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Empty, LoadState, PageTitle, PrivateImage, SectionLabel, Sheet, StatusPill, Thread, type Message } from '../ui';
import { dayShort, usePortal } from '../usePortal';

type Tone = 'waiting' | 'action' | 'good' | 'closed';
interface RequestRow {
  id: string;
  ref: string;
  kind: 'consultation' | 'booking';
  title: string;
  status: string;
  statusLabel: string;
  tone: Tone;
  submittedAt: string;
  updatedAt: string;
  projectId: string | null;
  unread: number;
}
interface RequestDetail extends Omit<RequestRow, 'unread' | 'projectId'> {
  summary: Record<string, unknown>;
  references: { url: string; note: string | null }[];
  project: { id: string; title: string } | null;
  becameProject: { id: string; title: string } | null;
  messages: Message[];
}

/** what each stage means for them, in a sentence */
const MEANING: Record<string, string> = {
  submitted: 'Younes has your request and will read it himself.',
  'under-review': 'Younes is looking at it.',
  contacted: 'Younes is looking at it.',
  'changes-requested': 'Younes needs a little more from you - see his message below.',
  accepted: 'Younes said yes. Your project takes shape from here.',
  booking: 'Accepted - a time is being arranged.',
  declined: 'Younes isn’t able to take this one on. His message explains why.',
  completed: 'This request is complete.',
};

const ANSWERS: [string, string][] = [
  ['concept', 'The idea'],
  ['meaning', 'Behind it'],
  ['bodyArea', 'Where'],
  ['placement', 'More precisely'],
  ['scale', 'Roughly how big'],
  ['size', 'In your words'],
  ['timing', 'Timeframe'],
  ['notes', 'Anything else'],
  ['preferredTimes', 'When suits you'],
];
const WORDS: Record<string, string> = {
  forearm: 'Forearm', 'upper-arm': 'Upper arm', shoulder: 'Shoulder', chest: 'Chest', back: 'Back', leg: 'Leg', hand: 'Hand', other: 'Elsewhere', 'not-sure': 'Not sure yet',
  small: 'Small', medium: 'Medium', large: 'Large', 'large-scale': 'Large-scale',
  soon: 'Soon', months: 'In the next few months', 'no-rush': 'No rush',
};

export function RequestsPage() {
  useDocumentTitle('Your requests');
  const [state] = usePortal<RequestRow[]>('/requests');
  const consultation = useConsultation();
  return (
    <div className="grid gap-10">
      <PageTitle eyebrow="Your account" title="Requests">
        <Button variant="primary" onClick={() => consultation.open({ from: 'book' })}>
          New consultation <span aria-hidden="true">&rarr;</span>
        </Button>
      </PageTitle>
      <p className="-mt-4 max-w-[64ch] text-body leading-copy text-ink-soft">
        Ideas and booking requests you’ve sent, and where each one stands. A request is never an appointment by itself - Younes answers it,
        and proposes a time when it’s right.
      </p>
      <LoadState state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="You haven’t sent anything yet." action={<Button variant="primary" onClick={() => consultation.open({ from: 'book' })}>Tell Younes your idea</Button>} />
          ) : (
            <ol className="border-t border-ink">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-rule">
                  <Link to={`/portal/requests/${r.id}`} className="group grid gap-x-6 gap-y-2 py-5 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center">
                    <span className="min-w-0">
                      <span className="type-meta text-ink-soft">
                        {r.kind === 'booking' ? 'Booking request' : 'Consultation'} · {r.ref} · sent {dayShort(r.submittedAt)}
                      </span>
                      <span className="mt-1 block truncate font-serif text-[1.45rem] leading-tight group-hover:text-burgundy">{r.title}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      {r.unread > 0 && <span className="type-meta text-burgundy">{r.unread} new message{r.unread > 1 ? 's' : ''}</span>}
                      <StatusPill label={r.statusLabel} tone={r.tone} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )
        }
      </LoadState>
    </div>
  );
}

export function RequestPage() {
  const { requestId } = useParams();
  const [state, reload] = usePortal<RequestDetail>(requestId ? `/requests/${requestId}` : null);
  useDocumentTitle('Your request');
  return (
    <LoadState state={state}>
      {(r) => (
        <div className="grid gap-[clamp(2rem,5vh,3rem)]">
          <PageTitle eyebrow={`${r.kind === 'booking' ? 'Booking request' : 'Consultation'} · ${r.ref}`} title={r.title}>
            <StatusPill label={r.statusLabel} tone={r.tone} />
          </PageTitle>
          <Sheet className={r.tone === 'action' ? 'border-l-2 border-l-burgundy' : undefined}>
            <p className="font-serif text-[1.35rem] leading-snug">{MEANING[r.status] ?? 'Younes will be in touch.'}</p>
            {r.becameProject && (
              <p className="mt-3 text-body">
                It’s now a project:{' '}
                <Link to={`/portal/projects/${r.becameProject.id}`} className="underline decoration-burgundy underline-offset-4 hover:text-burgundy">
                  {r.becameProject.title}
                </Link>
              </p>
            )}
            {r.project && (
              <p className="mt-3 text-body">
                For your project{' '}
                <Link to={`/portal/projects/${r.project.id}`} className="underline decoration-burgundy underline-offset-4 hover:text-burgundy">
                  {r.project.title}
                </Link>
              </p>
            )}
          </Sheet>

          <div className="grid gap-8 desktop:grid-cols-12">
            <section aria-labelledby="sent" className="desktop:col-span-5">
              <SectionLabel id="sent">What you sent · {dayShort(r.submittedAt)}</SectionLabel>
              <dl className="mt-4 border-t border-rule">
                {ANSWERS.filter(([k]) => typeof r.summary[k] === 'string' && r.summary[k]).map(([k, label]) => (
                  <div key={k} className="grid gap-1 border-b border-rule py-3">
                    <dt className="type-meta text-ink-soft">{label}</dt>
                    <dd className="text-body leading-copy whitespace-pre-line">{WORDS[r.summary[k] as string] ?? (r.summary[k] as string)}</dd>
                  </div>
                ))}
              </dl>
              {r.references.length > 0 && (
                <div className="mt-6">
                  <SectionLabel>Your images · {r.references.length}</SectionLabel>
                  <ul className="mt-3 grid grid-cols-3 gap-3">
                    {r.references.map((ref, i) => (
                      <li key={ref.url}>
                        <PrivateImage src={ref.url} alt={`Your reference image ${i + 1}`} ratio="1 / 1" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <section aria-labelledby="conversation" className="desktop:col-span-7">
              <SectionLabel id="conversation">Conversation with Younes</SectionLabel>
              <div className="mt-4">
                <Thread messages={r.messages} postTo={`/requests/${r.id}/messages`} onSent={reload} empty="No messages yet. Younes writes here when he replies - you’ll also get an email." />
              </div>
            </section>
          </div>
        </div>
      )}
    </LoadState>
  );
}

/** asking to book a session for one of their projects - a request Younes answers, not a booking */
export function BookingRequestPage() {
  useDocumentTitle('Ask to book a session');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [projects] = usePortal<{ id: string; title: string; status: string }[]>('/projects');
  const [projectId, setProjectId] = useState(params.get('project') ?? '');
  const [preferredTimes, setPreferredTimes] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [key] = useState(() => crypto.randomUUID());

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      const r = await clientApi<{ id: string }>('/requests', { body: { kind: 'booking', idempotencyKey: key, projectId, preferredTimes, notes: notes || undefined, consent, privacyNoticeVersion: PRIVACY_NOTICE_VERSION } });
      navigate(`/portal/requests/${r.id}`);
    } catch (err) {
      setProblem(errorText(err));
      if (err instanceof ClientApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <PageTitle eyebrow="Your account · Requests" title="Ask to book a session" />
      <p className="-mt-2 text-body leading-copy text-ink-soft">Tell Younes when suits you. He’ll answer with a proposed time - nothing is booked until then.</p>
      <LoadState state={projects}>
        {(list) =>
          list.length === 0 ? (
            <Empty title="Booking starts from a project.">Once Younes accepts your idea and it becomes a project, you can ask to book its session here.</Empty>
          ) : (
            <Sheet>
              <form onSubmit={submit} noValidate className="grid gap-6">
                <div className="grid gap-2">
                  <label htmlFor="bookingProject" className="type-meta text-ink">
                    Which project
                  </label>
                  <select
                    id="bookingProject"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    aria-invalid={fields.projectId ? true : undefined}
                    className="min-h-12 border border-ink/30 bg-paper px-3 text-body text-ink focus:border-ink"
                  >
                    <option value="">Choose…</option>
                    {list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  {fields.projectId && <p className="text-micro text-burgundy">Choose a project</p>}
                </div>
                <div className="grid gap-2">
                  <label htmlFor="bookingWhen" className="type-meta text-ink">
                    When suits you
                  </label>
                  <textarea
                    id="bookingWhen"
                    rows={3}
                    maxLength={500}
                    value={preferredTimes}
                    onChange={(e) => setPreferredTimes(e.target.value)}
                    placeholder="Weekday mornings, any time after March 10…"
                    aria-invalid={fields.preferredTimes ? true : undefined}
                    aria-describedby={fields.preferredTimes ? 'bookingWhenError' : undefined}
                    className="border border-ink/30 bg-paper px-3 py-2.5 text-body leading-copy text-ink focus:border-ink"
                  />
                  {fields.preferredTimes && (
                    <p id="bookingWhenError" className="text-micro text-burgundy">
                      {fields.preferredTimes}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <label htmlFor="bookingNotes" className="type-meta text-ink">
                    Anything else <span className="text-ink-soft">(optional)</span>
                  </label>
                  <textarea id="bookingNotes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-ink/30 bg-paper px-3 py-2.5 text-body leading-copy text-ink focus:border-ink" />
                </div>
                <div className="border-t border-rule pt-6">
                  <PrivacyNotice />
                  <label className="mt-5 flex cursor-pointer items-start gap-3 text-body leading-copy text-ink">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-burgundy" aria-invalid={fields.consent ? true : undefined} />
                    <span>I’ve read how my details are used.</span>
                  </label>
                  {fields.consent && <p className="mt-1.5 text-micro text-burgundy">{fields.consent}</p>}
                </div>
                {problem && (
                  <p role="alert" className="border-l-2 border-burgundy pl-3 text-body text-burgundy">
                    {problem}
                  </p>
                )}
                <div className="border-t border-rule pt-6">
                  <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? 'Sending…' : 'Send the request'}
                  </Button>
                </div>
              </form>
            </Sheet>
          )
        }
      </LoadState>
    </div>
  );
}
