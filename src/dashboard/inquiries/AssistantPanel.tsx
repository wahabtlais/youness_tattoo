import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { button } from '../ui';
import type { InquiryDetailData } from './useInquiryDetail';

interface AiStatus {
  configured: boolean;
  reason: string | null;
  budget: { daily: number; monthly: number; usedToday: number; usedThisMonth: number };
}

/**
 * The assistant on one inquiry: a summary of the idea, or a reply draft -
 * each a *proposal* you approve (kept as a note) or reject. Nothing is
 * sent, and no record changes, until you decide. When no AI is configured
 * on the server the panel says so and offers nothing.
 */
export function AssistantPanel({ inquiryId, proposals, onChanged }: { inquiryId: string; proposals: InquiryDetailData['proposals']; onChanged: () => void }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api<AiStatus>('/api/studio/ai/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const ask = async (task: 'summary' | 'reply-draft') => {
    setBusy(task);
    setProblem(null);
    try {
      await api(`/api/studio/ai/inquiries/${inquiryId}/${task}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id);
    setProblem(null);
    try {
      await api(`/api/studio/ai/proposals/${id}/decision`, { body: { decision } });
      onChanged();
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const pending = proposals.filter((p) => p.status === 'pending');
  return (
    <section aria-labelledby="aiPanel" className="studio-card p-[clamp(1rem,1.8vw,1.35rem)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="aiPanel" className="type-heading text-[1.05rem] leading-tight">
          Assistant
        </h2>
        <span className="text-[0.8125rem] text-ink-muted">{status?.configured ? 'Proposals only · you decide' : 'Not configured'}</span>
      </div>
      {!status?.configured ? (
        <p className="text-[0.875rem] leading-snug text-ink-muted">No AI is configured on this server, so there’s nothing to ask. Everything else here works without it.</p>
      ) : (
        <>
          <p className="text-[0.875rem] leading-snug text-ink-soft">It sees the brief only - never the client’s name or contact details - and nothing it writes is sent or saved until you approve it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => void ask('summary')} className={button('secondary', 'sm')}>
              {busy === 'summary' ? 'Summarising…' : 'Summarise'}
            </button>
            <button type="button" disabled={!!busy} onClick={() => void ask('reply-draft')} className={button('secondary', 'sm')}>
              {busy === 'reply-draft' ? 'Drafting…' : 'Draft a reply'}
            </button>
          </div>
          <p className="mt-2 text-[0.75rem] text-ink-muted">
            Spent today ${status.budget.usedToday.toFixed(2)} of ${status.budget.daily.toFixed(2)} · this month ${status.budget.usedThisMonth.toFixed(2)} of ${status.budget.monthly.toFixed(2)}
          </p>
        </>
      )}
      {problem && (
        <p role="alert" data-tone="danger" className="mt-3 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-(--st-fg)">
          {problem}
        </p>
      )}
      {pending.length > 0 && (
        <ul aria-label="Waiting for your decision" className="mt-4 grid gap-3">
          {pending.map((p) => (
            <li key={p.id} data-tone="accent" className="rounded-(--studio-r-md) border border-(--st-line) bg-(--st-bg) p-3">
              <p className="text-[0.75rem] font-semibold text-(--st-fg)">{p.task === 'reply-draft' ? 'Reply draft' : 'Summary'} · waiting for you</p>
              <p className="mt-1.5 text-[0.9375rem] leading-snug whitespace-pre-wrap text-ink">{p.content}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={!!busy} onClick={() => void decide(p.id, 'approve')} className={button('primary', 'sm')}>
                  {p.task === 'reply-draft' ? 'Keep as a note' : 'Approve'}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void decide(p.id, 'reject')} className={button('ghost', 'sm')}>
                  Reject
                </button>
              </div>
              {p.task === 'reply-draft' && <p className="mt-2 text-[0.75rem] text-ink-muted">Keeping it saves it as a private note to copy from. It is never sent from here.</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
