import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { preferenceLabel } from '../../components/find-similar/findSimilarSession';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import type { ConsultationStatus, ConsultationSummary } from '../../domain/consultation';
import { cx } from '../../lib/cx';
import { useCanvasCalls } from '../../hooks/useContent';
import { useWork } from '../../hooks/useWork';
import { DashIcon } from '../DashIcon';
import { ago, fullDate, STATUS_LABEL } from '../format';
import type { InquiryRecord } from '../types';
import { api, errorText } from '../api';
import { button, field } from '../ui';
import { reloadOverview } from '../useOverview';
import { AssistantPanel } from './AssistantPanel';
import { useInquiryDetail, type InquiryDetailData } from './useInquiryDetail';
import { BODY_AREAS, entryLabel, labelOf, SCALES, STATUSES, TIMEFRAMES } from './inquiryText';
import { StatusBadge } from './StatusBadge';


/** what usually comes next at each stage - the map's "usual next step", in words */
const NEXT_STEP: Record<ConsultationStatus, string> = {
  draft: 'Not submitted by the client yet.',
  submitted: 'Read the brief and reply - ask for anything missing, or take it into review.',
  'under-review': 'Decide: accept it, ask for more details, or decline.',
  'changes-requested': 'Waiting on the client for the details you asked for.',
  accepted: 'Contact the client to talk the design through.',
  contacted: 'Agree a date and the deposit for the first session.',
  booking: 'The session is being booked - confirm the date with the client.',
  completed: 'Finished. Nothing waits on you here.',
  declined: 'Closed. Nothing waits on you here.',
};

type Answer = Exclude<keyof ConsultationSummary, 'references' | 'style' | 'colour' | 'likes' | 'dislikes' | 'notes'>;

/** the consultation form's questions, as the reply would ask them */
const QUESTIONS: { key: Answer; label: string; ask: string }[] = [
  { key: 'concept', label: 'The idea', ask: 'What would you like the tattoo to be?' },
  { key: 'meaning', label: 'Story behind it', ask: 'Is there a story or a feeling behind it?' },
  { key: 'bodyArea', label: 'Body area', ask: 'Where on your body would you like it?' },
  { key: 'placement', label: 'Exact placement', ask: 'Where exactly would it sit?' },
  { key: 'scale', label: 'Size', ask: 'Roughly how big would you like it?' },
  { key: 'size', label: 'Size in their words', ask: 'Could you describe the size, or measure the area?' },
  { key: 'timing', label: 'Timeframe', ask: 'When are you hoping to get it done?' },
];

/** what the website's form doesn't ask for yet - never "missing" from the client, but often needed */
const NOT_COLLECTED: { key: string; label: string; ask: string }[] = [
  { key: 'images', label: 'Reference images', ask: 'Do you have any reference images you’d like me to see?' },
  { key: 'style', label: 'Style and colour', ask: 'Do you see it in black and grey, or in colour?' },
];

function draftFor(q: InquiryRecord, asks: string[]) {
  const first = q.clientName.split(' ')[0];
  const about = q.summary.concept ? `your idea - ${q.summary.concept.charAt(0).toLowerCase()}${q.summary.concept.slice(1)}` : 'your tattoo idea';
  const body = asks.length
    ? `Before I can say more, could you tell me:\n${asks.map((a) => `- ${a}`).join('\n')}`
    : 'I’ve read through everything you sent and I’ll be in touch about next steps.';
  return `Hi ${first},\n\nThank you for getting in touch about ${about}. ${body}\n\nYounes`;
}

/**
 * One inquiry as a workspace. The header says who and what, where it stands
 * and where it came from, with the main action (draft a reply) and the way
 * to the previous and next inquiry. The main column is the client's brief,
 * structured, with references only when the website recorded some. The side
 * column is the studio's: the usual next step and a status change, a
 * checklist of what's missing - answers the client didn't give, apart from
 * what the website doesn't collect - and private notes. The record's
 * details sit quietly under the brief, so the two columns balance.
 *
 * The status and private notes are saved (and recorded in the history);
 * the contact details are the ones the client gave. The reply draft is
 * never sent from here - it's copied into your own email - and the
 * assistant (when configured) only proposes; you decide.
 */
export function InquiryDetail({
  inquiry: q,
  now,
  category,
  position,
  prev,
  next,
}: {
  inquiry: InquiryRecord;
  now: Date;
  /** the list it was opened from */
  category: { label: string; to: string };
  /** where it sits in that list, if it's in it */
  position?: { index: number; total: number };
  prev?: { to: string; name: string };
  next?: { to: string; name: string };
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const draftBox = useRef<HTMLTextAreaElement>(null);
  const s = q.summary;
  const detail = useInquiryDetail(q.id);
  const contact = detail.data?.client;
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusNote, setStatusNote] = useState<{ ok: boolean; text: string } | null>(null);
  const changeStatus = async (status: ConsultationStatus) => {
    setStatusSaving(true);
    setStatusNote(null);
    try {
      await api(`/api/studio/inquiries/${q.id}/status`, { method: 'PATCH', body: { status } });
      await Promise.all([reloadOverview(), detail.reload()]);
      setStatusNote({ ok: true, text: `Saved: now ${STATUS_LABEL[status]}. The client isn’t told automatically.` });
    } catch (e) {
      setStatusNote({ ok: false, text: errorText(e) });
    } finally {
      setStatusSaving(false);
    }
  };
  const open = q.status !== 'completed' && q.status !== 'declined';

  const missing = useMemo(() => QUESTIONS.filter((x) => !s[x.key]), [s]);
  // answered, but with "Not sure yet": genuinely unknown, worth asking about
  const unsure = useMemo(() => QUESTIONS.filter((x) => s[x.key] === 'not-sure'), [s]);
  // what the reply asks: every unanswered or unsure question to begin with
  const [asking, setAsking] = useState<Set<string>>(() => new Set([...missing, ...unsure].map((m) => m.key)));
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const asks = [...QUESTIONS, ...NOT_COLLECTED].filter((x) => asking.has(x.key)).map((x) => x.ask);
  // the draft follows the checklist until it's edited by hand
  const text = draft ?? draftFor(q, asks);

  // a newly opened inquiry is announced from its heading, with a fresh checklist and draft
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [q.id]);

  const toggle = (key: string) =>
    setAsking((a) => {
      const n = new Set(a);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const startDraft = () => {
    setDrafting(true);
    draftBox.current?.focus();
  };
  // once the draft panel is drawn, the writing starts there
  useEffect(() => {
    if (drafting) draftBox.current?.focus();
  }, [drafting]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <article aria-labelledby={`${id}-name`} className="grid gap-5">
      {/* who, what, where it stands - and the actions */}
      <header className="studio-card flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-[clamp(1rem,2vw,1.5rem)]">
        <div className="min-w-0 flex-1 basis-88">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={q.status} />
            {q.demo && <span className="inline-flex h-7 items-center rounded-full border border-dashed border-(--studio-line-strong) px-2.5 text-[0.8125rem] text-ink-soft">Sample</span>}
          </div>
          <h1 id={`${id}-name`} ref={heading} tabIndex={-1} className="studio-title mt-2.5 text-[clamp(1.75rem,2.6vw,2.4rem)] leading-tight outline-none">
            {q.clientName}
          </h1>
          <p className="mt-1 text-lede leading-snug text-ink-soft">{s.concept ?? 'No idea described yet'}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <DashIcon name="clock" className="size-3.5" />
              <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)}>
                Received {ago(now, q.receivedAt)}
              </time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DashIcon name="inquiries" className="size-3.5" />
              {entryLabel(q.entry)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {open && (
            <button type="button" onClick={startDraft} aria-expanded={drafting} aria-controls={`${id}-draft`} className={button('primary')}>
              <DashIcon name="reply" className="size-4" />
              Draft a reply
            </button>
          )}
          <nav aria-label={`More in ${category.label}`} className="flex items-center gap-1">
            {prev ? (
              <Link to={prev.to} title={`Previous: ${prev.name}`} aria-label={`Previous in ${category.label}: ${prev.name}`} className={button('secondary', 'md', 'px-2.5')}>
                <DashIcon name="arrow" className="size-4 rotate-180" />
              </Link>
            ) : (
              <span aria-hidden="true" className={button('secondary', 'md', 'px-2.5 opacity-40')}>
                <DashIcon name="arrow" className="size-4 rotate-180" />
              </span>
            )}
            {position && (
              <span className="min-w-14 px-1 text-center text-[0.8125rem] text-ink-muted tabular-nums">
                {position.index + 1} of {position.total}
              </span>
            )}
            {next ? (
              <Link to={next.to} title={`Next: ${next.name}`} aria-label={`Next in ${category.label}: ${next.name}`} className={button('secondary', 'md', 'px-2.5')}>
                <DashIcon name="arrow" className="size-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className={button('secondary', 'md', 'px-2.5 opacity-40')}>
                <DashIcon name="arrow" className="size-4" />
              </span>
            )}
          </nav>
        </div>
      </header>

      <div className="grid items-start gap-5 @min-[60rem]:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
        {/* the client's brief, and the reply to it */}
        <div className="grid content-start gap-5">
          {drafting && (
            <section id={`${id}-draft`} aria-labelledby={`${id}-draft-h`} className="studio-card border-burgundy/40 p-[clamp(1rem,1.8vw,1.35rem)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`${id}-draft-h`} className="type-heading text-[1.05rem]">
                  Reply to {q.clientName.split(' ')[0]}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-(--studio-sunken) px-2.5 py-1 text-[0.75rem] font-medium text-ink-soft">Draft only · not sent</span>
              </div>
              <p className="mt-1 text-[0.875rem] text-ink-muted">
                {draft === null ? 'Built from the checklist - tick or untick a question and it updates.' : 'Edited by hand - the checklist no longer changes it.'} It isn’t sent from here - copy it into your own email{contact?.email ? ` to ${contact.email}` : ''}.
              </p>
              <label htmlFor={`${id}-draft-text`} className="sr-only">
                Reply draft
              </label>
              <textarea
                id={`${id}-draft-text`}
                ref={draftBox}
                rows={9}
                value={text}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setCopied('idle');
                }}
                className={cx(field, 'mt-3 block w-full resize-y py-2.5 leading-relaxed')}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={copy} className={button('primary')}>
                  {copied === 'done' ? <DashIcon name="check" className="size-4" /> : null}
                  {copied === 'done' ? 'Copied' : 'Copy draft'}
                </button>
                {draft !== null && (
                  <button type="button" onClick={() => setDraft(null)} className={button('secondary')}>
                    Rebuild from the checklist
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDrafting(false);
                    setDraft(null);
                    setCopied('idle');
                  }}
                  className={button('ghost')}
                >
                  Discard
                </button>
                <span aria-live="polite" className="text-[0.8125rem] text-ink-muted">
                  {copied === 'done' ? 'Copied to the clipboard.' : copied === 'failed' ? 'Couldn’t reach the clipboard - select the text and copy it.' : ''}
                </span>
              </div>
            </section>
          )}

          <Section title="Tattoo brief">
            <div className="grid gap-5">
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-muted">The idea</p>
                <p className="mt-1 text-[1.2rem] leading-snug text-ink">{s.concept ?? <NotProvided />}</p>
              </div>
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-muted">Story behind it</p>
                <p className="mt-1 max-w-[62ch] text-body leading-relaxed text-ink">{s.meaning ?? <NotProvided />}</p>
              </div>
              <dl className="grid gap-px overflow-hidden rounded-(--studio-r-md) border border-rule bg-(--studio-line) @min-[34rem]:grid-cols-2 @min-[34rem]:[&>:last-child:nth-child(odd)]:col-span-2">
                <Fact label="Body area">{labelOf(BODY_AREAS, s.bodyArea)}</Fact>
                <Fact label="Exact placement">{s.placement}</Fact>
                <Fact label="Size">
                  {s.scale && (
                    <>
                      {labelOf(SCALES, s.scale)}
                      {SCALES.find((x) => x.value === s.scale)?.hint && <span className="block text-[0.8125rem] text-ink-muted">{SCALES.find((x) => x.value === s.scale)?.hint}</span>}
                    </>
                  )}
                </Fact>
                <Fact label="Size in their words">{s.size}</Fact>
                <Fact label="Timeframe">{labelOf(TIMEFRAMES, s.timing)}</Fact>
              </dl>
              {s.notes && (
                <div className="rounded-(--studio-r-md) bg-(--studio-sunken) px-4 py-3">
                  <p className="text-[0.8125rem] font-medium text-ink-muted">Anything else they added</p>
                  <p className="mt-1 text-body leading-relaxed text-ink">{s.notes}</p>
                </div>
              )}
            </div>
          </Section>

          {(q.entry.from === 'find-similar' || q.entry.from === 'canvas-call') && (
            <Section title="References">
              <References inquiry={q} />
            </Section>
          )}

          {/* the record: quiet, under the brief, in columns where there's room */}
          <Section title="Record details">
            <dl className="grid gap-x-6 gap-y-3 text-[0.875rem] @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3">
              <Row label="Received">
                <time dateTime={q.receivedAt}>{fullDate(q.receivedAt)}</time>
              </Row>
              <Row label="Source">{entryLabel(q.entry)}</Row>
              <Row label="Listed under">
                <Link to={category.to} className="font-medium text-burgundy underline-offset-4 hover:underline">
                  {category.label}
                </Link>
              </Row>
              <Row label="Email">
                {contact?.email ? (
                  <a href={`mailto:${contact.email}`} className="font-medium text-burgundy underline-offset-4 hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-ink-muted">{q.demo ? 'None - a sample record' : 'Not given'}</span>
                )}
              </Row>
              {contact?.phone && <Row label="Phone">{contact.phone}</Row>}
              {contact?.instagram && <Row label="Instagram">@{contact.instagram}</Row>}
              <Row label="Reference">
                <span className="studio-code text-[0.8125rem] text-ink-soft">{detail.data?.publicRef ?? q.publicRef ?? q.id}</span>
              </Row>
              {detail.data?.consentAt && <Row label="Consent">Agreed {fullDate(detail.data.consentAt)} (notice {detail.data.privacyNoticeVersion})</Row>}
              {q.clientId && (
                <Row label="Client record">
                  <Link to={`/studio/clients/${q.clientId}`} className="font-medium text-burgundy underline-offset-4 hover:underline">
                    {q.clientName}
                  </Link>
                </Row>
              )}
            </dl>
          </Section>
        </div>

        {/* the studio's side: the next step, what's missing, private notes */}
        <aside aria-label="Working on this inquiry" className="grid content-start gap-5">
          <Section title="Next step" aside={<StatusBadge status={q.status} size="sm" />}>
            <p className="text-[1rem] leading-snug font-medium text-ink">{NEXT_STEP[q.status]}</p>
            <div className="mt-4 grid gap-1.5">
              <label htmlFor={`${id}-status`} className="text-[0.8125rem] font-medium text-ink-soft">
                Move to a stage
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select id={`${id}-status`} value={q.status} disabled={statusSaving} onChange={(e) => void changeStatus(e.target.value as ConsultationStatus)} className={cx(field, 'min-h-10 flex-1')}>
                  {STATUSES.map((st) => (
                    <option key={st.status} value={st.status} className="bg-(--studio-raised)">
                      {STATUS_LABEL[st.status]}
                    </option>
                  ))}
                </select>
                {statusSaving && <span className="text-[0.8125rem] text-ink-muted">Saving…</span>}
              </div>
              <p role="status" data-tone={statusNote ? (statusNote.ok ? 'success' : 'danger') : undefined} className={cx('text-[0.8125rem] leading-snug', statusNote ? 'text-(--st-fg)' : 'text-ink-muted')}>
                {statusNote?.text ?? 'Saved as soon as you choose. The client isn’t told automatically.'}
              </p>
            </div>
          </Section>

          <Section title="Missing information" aside={missing.length ? `${missing.length} missing` : "Form complete"}>
            <fieldset>
              <legend className="text-[0.8125rem] font-semibold text-ink-soft">The client didn’t answer</legend>
              {missing.length === 0 ? (
                <p className="mt-1.5 flex items-center gap-2 text-body text-ink-soft">
                  <DashIcon name="check" className="size-4 text-ink-muted" />
                  They answered every question the form asks.
                </p>
              ) : (
                <ul className="mt-1.5 grid gap-0.5">
                  {missing.map((m) => (
                    <Check key={m.key} label={m.label} checked={asking.has(m.key)} onChange={() => toggle(m.key)} />
                  ))}
                </ul>
              )}
            </fieldset>
            {unsure.length > 0 && (
              <fieldset className="mt-4 border-t border-rule pt-3">
                <legend className="float-left w-full text-[0.8125rem] font-semibold text-ink-soft">The client isn’t sure yet</legend>
                <ul className="clear-both grid gap-0.5 pt-1.5">
                  {unsure.map((m) => (
                    <Check key={m.key} label={m.label} checked={asking.has(m.key)} onChange={() => toggle(m.key)} />
                  ))}
                </ul>
              </fieldset>
            )}
            <fieldset className="mt-4 border-t border-rule pt-3">
              <legend className="float-left w-full text-[0.8125rem] font-semibold text-ink-soft">The website doesn’t collect</legend>
              <ul className="clear-both grid gap-0.5 pt-1.5">
                {NOT_COLLECTED.map((m) => (
                  <Check key={m.key} label={m.label} checked={asking.has(m.key)} onChange={() => toggle(m.key)} />
                ))}
              </ul>
            </fieldset>
            <p className="mt-3 text-[0.8125rem] leading-snug text-ink-muted">Ticked items become questions in the reply draft.</p>
            {open && !drafting && (
              <button type="button" onClick={startDraft} className={button('secondary', 'sm', 'mt-3')}>
                <DashIcon name="reply" className="size-3.5" />
                Ask in a reply
              </button>
            )}
          </Section>

          <Notes inquiryId={q.id} notes={detail.data?.notes ?? []} onChanged={() => void detail.reload()} />

          <AssistantPanel inquiryId={q.id} proposals={detail.data?.proposals ?? []} onChanged={() => void detail.reload()} />

        </aside>
      </div>
    </article>
  );
}

/** a panel of the workspace, under a clear heading */
function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="studio-card @container p-[clamp(1rem,1.8vw,1.35rem)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={id} className="type-heading text-[1.05rem] leading-tight">
          {title}
        </h2>
        {aside && <span className="text-right text-[0.8125rem] text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** one fact of the brief, in the grid */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-(--studio-panel) px-3.5 py-3">
      <dt className="text-[0.8125rem] font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body leading-snug text-ink">{children || <NotProvided />}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-ink">{children}</dd>
    </div>
  );
}

const NotProvided = () => <span className="text-body text-ink-muted italic">Not provided</span>;

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <li>
      <label className="-mx-2 flex min-h-9 cursor-pointer items-center gap-2.5 rounded-(--studio-r-md) px-2 text-body text-ink hover:bg-(--studio-sunken)">
        <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-(--studio-accent)" />
        {label}
      </label>
    </li>
  );
}

/** private notes: never shown to the client; saved, and part of the inquiry's history */
function Notes({ inquiryId, notes, onChanged }: { inquiryId: string; notes: InquiryDetailData['notes']; onChanged: () => void }) {
  const id = useId();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  return (
    <Section title="Private notes" aside="Only you · saved">
      {notes.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2 text-body leading-snug whitespace-pre-wrap text-ink">
              {n.body}
              <span className="mt-0.5 block text-[0.75rem] text-ink-muted">
                {ago(new Date(), n.createdAt)}
                {n.source === 'assistant' ? ' · from the assistant, approved by you' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p role="alert" data-tone="danger" className="mb-2 text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </p>
      )}
      {writing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || saving) return;
            setSaving(true);
            setProblem(null);
            try {
              await api(`/api/studio/inquiries/${inquiryId}/notes`, { body: { body: text.trim() } });
              setText('');
              setWriting(false);
              onChanged();
            } catch (err) {
              setProblem(errorText(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label htmlFor={`${id}-note`} className="sr-only">
            Private note
          </label>
          <textarea
            id={`${id}-note`}
            ref={box}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="A thought for later…"
            className={cx(field, 'block w-full resize-y py-2 leading-snug')}
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="submit" disabled={!text.trim() || saving} className={button('secondary', 'sm')}>
              {saving ? 'Saving…' : 'Add note'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWriting(false);
                setText('');
              }}
              className={button('ghost', 'sm')}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {notes.length === 0 && <p className="mb-3 rounded-(--studio-r-md) border border-dashed border-(--studio-line-strong) px-3 py-2.5 text-[0.875rem] leading-snug text-ink-muted">Never shown to the client. Notes are saved with the inquiry.</p>}
          <button
            type="button"
            onClick={() => {
              setWriting(true);
              requestAnimationFrame(() => box.current?.focus());
            }}
            className={button('secondary', 'sm')}
          >
            Add a private note
          </button>
        </>
      )}
    </Section>
  );
}

/** the references the website records for this inquiry */
function References({ inquiry: q }: { inquiry: InquiryRecord }) {
  const work = useWork();
  const calls = useCanvasCalls();
  const e = q.entry;

  if (e.from === 'find-similar') {
    const ids = [e.workId, ...(e.selection?.references ?? [])];
    const pieces = work.status === 'success' ? ids.map((wid) => work.data.find((w) => w.id === wid)).filter((w) => !!w) : [];
    return (
      <div className="grid gap-3">
        <p className="text-body leading-snug text-ink-soft">
          Started from piece {e.workId} in Find Similar
          {e.selection?.drawnTo.length ? `, drawn to: ${e.selection.drawnTo.map((d) => preferenceLabel(d).toLowerCase()).join(', ')}` : ''}.
        </p>
        {e.selection?.note && <p className="border-l-[3px] border-burgundy/50 pl-3 text-body leading-snug text-ink italic">“{e.selection.note}”</p>}
        <ul className="flex flex-wrap gap-3">
          {pieces.map((p, i) => (
            <li key={p.id}>
              <a
                href={`/work/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="group block w-[min(100%,12rem)] rounded-(--studio-r-md)"
                aria-label={`Portfolio piece ${p.id}${i === 0 ? ', the one they started from' : ', kept in Find Similar'} (opens the public page)`}
              >
                <span className="block overflow-hidden rounded-(--studio-r-md) border border-rule transition-[border-color] group-hover:border-burgundy/60">
                  <ResponsiveImage image={p.image} alt="" ratio="4 / 5" sizes="192px" />
                </span>
                <span className="mt-1 block text-[0.8125rem] text-ink-muted group-hover:text-burgundy">
                  {p.id} · {i === 0 ? 'started from' : 'kept'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (e.from === 'canvas-call') {
    const call = calls.status === 'success' ? calls.data.items.find((c) => c.slug === e.callSlug) : undefined;
    return (
      <p className="text-body leading-snug text-ink-soft">
        Answers the canvas call{' '}
        <a href={`/canvas-calls/${e.callSlug}`} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-burgundy underline-offset-4 hover:text-burgundy">
          {call?.title ?? e.title}
        </a>
        {e.demo && <span className="ml-2 text-[0.8125rem] text-burgundy">demo call</span>}
      </p>
    );
  }
  return null;
}
