import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useWork } from '../../hooks/useWork';
import { attention, kpis, workload } from '../analytics';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { PageHeader } from '../components/PageHeader';
import { clock } from '../format';
import { STUDIO_ROOT } from '../navigation';
import { button } from '../ui';
import { useOverview } from '../useOverview';
import { api } from '../api';

/** things to ask, by the part of the studio they're about */
const PROMPTS: { icon: DashIconName; area: string; text: string }[] = [
  { icon: 'inquiries', area: 'Inquiries', text: 'Summarise the new inquiries and what each one is missing' },
  { icon: 'calendar', area: 'Schedule', text: 'What does my week look like, and which sessions still need confirming?' },
  { icon: 'alert', area: 'Follow-ups', text: 'Which follow-ups are overdue, and who is waiting on me?' },
  { icon: 'reply', area: 'Replies', text: 'Draft a reply asking Sample client B about colour — for me to review' },
  { icon: 'portfolio', area: 'Portfolio', text: 'Suggest titles and tags for the pieces that still need details' },
  { icon: 'publishing', area: 'Content', text: 'Which canvas calls are open, and how many people answered them?' },
];

/** what it does now (inside each inquiry), and what's still to come */
const PLANNED: { text: string; ready: boolean }[] = [
  { text: 'Summarise an inquiry and point out what’s missing', ready: true },
  { text: 'Draft a reply to a client for you to review', ready: true },
  { text: 'Answer questions about the schedule', ready: false },
  { text: 'Spot overdue follow-ups', ready: false },
  { text: 'Suggest titles, tags, styles and descriptions for the portfolio', ready: false },
  { text: 'Carry out studio tasks — only after you confirm each one', ready: false },
];

interface AiStatus {
  configured: boolean;
  reason: string | null;
  budget: { daily: number; monthly: number; usedToday: number; usedThisMonth: number };
}

interface Turn {
  id: number;
  text: string;
  at: Date;
}

/**
 * /studio/assistant - the assistant's status and the conversation
 * workspace. The assistant itself works inside each inquiry (a summary, a
 * reply draft - proposals you approve or reject), when the server has it
 * configured; this page shows whether it is, and what it has spent. Open
 * conversation isn't built, and the page says so wherever it matters: the
 * note under the composer, and a notice after every message you send.
 * Your messages stay in this tab only. Beside the conversation, what the
 * assistant would work from - real counts from the studio's demo records,
 * with the way to each - and what it's planned to do, and the rule it will
 * keep: nothing reaches a client or changes a booking without your
 * approval. No voice input or notifications: none exist.
 */
export function AssistantPage() {
  useDocumentTitle('Assistant');
  const [now] = useState(() => new Date());
  const overview = useOverview(now);
  const work = useWork();
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  useEffect(() => {
    api<AiStatus>('/api/studio/ai/status')
      .then(setAi)
      .catch(() => setAi(null));
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length]);

  if (overview.status !== 'success') return <StateMessage kind={overview.status === 'loading' ? 'loading' : 'error'} title="The assistant’s workspace couldn’t be loaded." />;
  const o = overview.data;
  const k = kpis(o, now);
  const today = workload(o, now)[0].appointments;
  const toConfirm = o.appointments.filter((a) => a.status === 'proposed' && new Date(a.endsAt) >= now).length;
  const unverified = work.status === 'success' ? work.data.filter((w) => w.metadataStatus !== 'verified').length : 0;
  const waiting = attention(o, now).length;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setTurns((t) => [...t, { id: t.length + 1, text, at: new Date() }]);
    setDraft('');
    box.current?.focus();
  };
  const use = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(text.length, text.length);
    });
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Assistant"
        summary="Ask about the studio, prepare replies and reminders. Anything that reaches a client, or changes a booking, waits for your approval."
        actions={
          <span data-tone={ai?.configured ? 'success' : 'neutral'} className="inline-flex h-8 items-center gap-2 rounded-full border border-(--st-line) bg-(--st-bg) px-3 text-[0.8125rem] font-semibold text-(--st-fg)">
            <span aria-hidden="true" className={ai?.configured ? 'size-2 rounded-full bg-(--st-solid)' : 'size-2 rounded-full border-2 border-(--st-solid)'} />
            {ai?.configured ? 'Ready · in each inquiry' : 'Not configured'}
          </span>
        }
      />

      <div className="grid items-start gap-5 @min-[64rem]:grid-cols-[minmax(0,1fr)_21rem]">
        {/* the conversation */}
        <section aria-label="Conversation" className="studio-card flex min-h-[32rem] min-w-0 flex-col overflow-hidden @min-[64rem]:h-[calc(100svh-var(--studio-bar)-var(--studio-main-top)-var(--studio-main-bottom)-7rem)] @min-[64rem]:min-h-[34rem]">
          <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
              <span data-tone="brand" aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-(--st-bg) text-(--st-fg)">
                <DashIcon name="sparkles" className="size-4" />
              </span>
              Studio assistant
            </p>
            {turns.length > 0 && (
              <button type="button" onClick={() => setTurns([])} className={button('ghost', 'sm')}>
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
            {turns.length === 0 ? (
              <div className="mx-auto max-w-[40rem] text-center">
                <span data-tone="brand" aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-(--st-bg) text-(--st-fg)">
                  <DashIcon name="sparkles" className="size-6" />
                </span>
                <h2 className="mt-4 type-heading text-[1.25rem]">What would you like to know?</h2>
                <p className="mx-auto mt-1.5 max-w-[50ch] text-[0.9375rem] leading-snug text-ink-soft">
                  Open conversation isn’t built yet, so nothing here answers. {ai?.configured ? 'Summaries and reply drafts are ready inside each inquiry.' : ''} These are the kinds of questions it’s being built for — choose one to put it in the box.
                </p>
                <ul className="mt-5 grid gap-2 text-left @min-[40rem]:grid-cols-2">
                  {PROMPTS.map((p) => (
                    <li key={p.text}>
                      <button
                        type="button"
                        onClick={() => use(p.text)}
                        className="group grid h-full w-full grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-(--studio-r-md) border border-rule bg-(--studio-panel) p-3 text-left transition-[border-color,background-color] hover:border-burgundy/50 hover:bg-(--studio-selected) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid"
                      >
                        <span aria-hidden="true" className="grid size-8 place-items-center rounded-(--studio-r-sm) bg-(--studio-sunken) text-ink-soft group-hover:text-burgundy">
                          <DashIcon name={p.icon} className="size-4" />
                        </span>
                        <span>
                          <span className="block text-[0.75rem] font-semibold text-ink-muted">{p.area}</span>
                          <span className="block text-[0.875rem] leading-snug text-ink">{p.text}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol aria-label="Messages" className="mx-auto grid max-w-[44rem] gap-4">
                {turns.map((t) => (
                  <li key={t.id} className="grid gap-2">
                    <div className="ml-auto max-w-[85%] rounded-(--studio-r-lg) rounded-br-(--studio-r-sm) bg-(--studio-selected) px-4 py-2.5">
                      <p className="sr-only">You:</p>
                      <p className="text-[0.9375rem] leading-snug whitespace-pre-wrap text-ink">{t.text}</p>
                      <p className="mt-1 text-right text-[0.6875rem] text-ink-muted">{clock(t.at.toISOString())} · this tab only</p>
                    </div>
                    <p data-tone="neutral" className="mx-auto flex max-w-[34rem] items-start gap-2 rounded-(--studio-r-md) border border-dashed border-(--st-line) px-3 py-2 text-[0.8125rem] leading-snug text-ink-soft">
                      <DashIcon name="alert" className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                      Not sent — open conversation isn’t built yet, so there’s no answer. Nothing was looked up, drafted or changed.
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <div ref={end} />
          </div>

          {/* the composer */}
          <form
            className="border-t border-rule p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="flex items-end gap-2 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-field) p-1.5 pl-3 transition-colors hover:border-ink-muted has-[textarea:focus-visible]:border-burgundy has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-1 has-[textarea:focus-visible]:outline-focus has-[textarea:focus-visible]:outline-solid">
              <label htmlFor="assistantInput" className="sr-only">
                Message the assistant
              </label>
              <textarea
                id="assistantInput"
                ref={box}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about inquiries, the schedule, the portfolio…"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[0.9375rem] leading-snug text-ink outline-none [field-sizing:content] placeholder:text-ink-muted"
              />
              <button type="submit" disabled={!draft.trim()} className={button('primary', 'md', 'px-3')} aria-label="Send">
                <DashIcon name="send" />
                <span className="max-[30rem]:hidden">Send</span>
              </button>
            </div>
            <p className="mt-2 px-1 text-[0.75rem] leading-snug text-ink-muted">Enter to send, Shift + Enter for a new line. Not built yet: messages stay in this tab and aren’t answered.</p>
          </form>
        </section>

        {/* what it would work from, and what it's for */}
        <aside aria-label="About the assistant" className="grid content-start gap-5">
          <section aria-labelledby="asstStatus" className="studio-card p-4">
            <h2 id="asstStatus" className="type-heading text-[1.05rem]">
              Status
            </h2>
            {ai?.configured ? (
              <>
                <p className="mt-1.5 text-[0.875rem] leading-snug text-ink-soft">Open an inquiry and choose Summarise or Draft a reply. It sees the brief only — never names or contact details.</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                  {[
                    ['Today', ai.budget.usedToday, ai.budget.daily],
                    ['This month', ai.budget.usedThisMonth, ai.budget.monthly],
                  ].map(([k, used, cap]) => (
                    <div key={k as string} className="rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2">
                      <dt className="text-[0.75rem] font-medium text-ink-muted">{k}</dt>
                      <dd className="text-[0.9375rem] font-bold text-ink tabular-nums">
                        ${(used as number).toFixed(2)} <span className="font-medium text-ink-muted">of ${(cap as number).toFixed(2)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[0.75rem] text-ink-muted">Limits are set in Settings. At the limit it stops until the next day or month.</p>
              </>
            ) : (
              <p className="mt-1.5 text-[0.875rem] leading-snug text-ink-soft">No AI is configured on this server{ai?.reason ? ` (${ai.reason})` : ''}. Everything else in the studio works without it.</p>
            )}
          </section>

          <section aria-labelledby="asstContext" className="studio-card p-4">
            <h2 id="asstContext" className="type-heading text-[1.05rem]">
              What it would work from
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Today’s sample records — counted here, not by the assistant</p>
            <ul className="mt-3 grid gap-1.5">
              {[
                { tone: 'attention', icon: 'inquiries' as const, label: 'New inquiries', value: k.newInquiries, to: `${STUDIO_ROOT}/inquiries/new` },
                { tone: k.overdue ? 'danger' : 'neutral', icon: 'alert' as const, label: 'Follow-ups overdue', value: k.overdue, to: `${STUDIO_ROOT}/clients` },
                { tone: 'success', icon: 'calendar' as const, label: `Appointments today${today[0] ? ` · first ${clock(today[0].startsAt)}` : ''}`, value: today.length, to: `${STUDIO_ROOT}/calendar?view=day` },
                { tone: 'attention', icon: 'clock' as const, label: 'Appointments to confirm', value: toConfirm, to: `${STUDIO_ROOT}/calendar` },
                { tone: 'info', icon: 'portfolio' as const, label: 'Pieces needing details', value: unverified, to: `${STUDIO_ROOT}/portfolio` },
                { tone: 'neutral', icon: 'bell' as const, label: 'Items needing your attention', value: waiting, to: STUDIO_ROOT },
              ].map((r) => (
                <li key={r.label} data-tone={r.tone}>
                  <Link to={r.to} className="group grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-(--studio-r-md) px-2 py-2 transition-colors hover:bg-(--studio-hover)">
                    <span aria-hidden="true" className="grid size-7 place-items-center rounded-(--studio-r-sm) bg-(--st-bg) text-(--st-fg)">
                      <DashIcon name={r.icon} className="size-3.5" />
                    </span>
                    <span className="truncate text-[0.875rem] text-ink-soft group-hover:text-ink">{r.label}</span>
                    <span className="text-[0.9375rem] font-bold text-ink tabular-nums">{r.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="asstPlanned" className="studio-card p-4">
            <h2 id="asstPlanned" className="type-heading text-[1.05rem]">
              What it does
            </h2>
            <ul className="mt-3 grid gap-2">
              {PLANNED.map((p) => (
                <li key={p.text} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-[0.875rem] leading-snug text-ink-soft">
                  {p.text}
                  {p.ready ? (
                    <span data-tone={ai?.configured ? 'success' : 'neutral'} className="rounded-full bg-(--st-bg) px-2 py-0.5 text-[0.6875rem] font-semibold text-(--st-fg)">
                      {ai?.configured ? 'Ready' : 'Built · needs setup'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-(--studio-sunken) px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-muted">Planned</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="asstRules" data-tone="brand" className="studio-card p-4">
            <h2 id="asstRules" className="flex items-center gap-2 type-heading text-[1.05rem]">
              <DashIcon name="check" className="size-4 text-(--st-fg)" />
              You stay in control
            </h2>
            <p className="mt-2 text-[0.875rem] leading-snug text-ink-soft">
              Everything it writes arrives as a proposal for you to approve or reject. It never sends, publishes or books on its own.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
