import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PROJECT_STATUS_LABEL } from '@younes/contracts';
import { api, errorText } from '../api';
import { button, field } from '../ui';
import { AccountLine } from './PortalThread';

export interface ClientPortalData {
  account?: { email: string; verified: boolean; createdAt: string } | null;
  projects?: { id: string; title: string; status: string; unreadMessages: number; unansweredPhotos: number }[];
  accountRequests?: { id: string; kind: 'deletion'; status: 'pending' | 'completed' | 'cancelled'; reason: string | null; requestedAt: string; resolvedAt: string | null; resolution: string | null }[];
}

/** a client's account, and their projects - with a way to start one that isn't from an inquiry */
export function ClientPortalCard({ clientId, data, onChanged }: { clientId: string; data: ClientPortalData; onChanged?: () => void }) {
  const id = useId();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const projects = data.projects ?? [];
  return (
    <section aria-labelledby={`${id}-h`} className="studio-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-h`} className="type-heading text-[1.05rem]">
          Account and projects
        </h3>
        <AccountLine account={data.account ?? null} />
      </div>
      {(data.accountRequests ?? [])
        .filter((r) => r.status === 'pending')
        .map((r) => (
          <AccountRequest key={r.id} request={r} onDone={() => onChanged?.()} />
        ))}
      {projects.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/studio/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-(--studio-r-md) border border-rule p-3 hover:bg-(--studio-hover)">
                <span className="text-[0.9375rem] font-semibold text-ink">{p.title}</span>
                <span className="text-[0.8125rem] text-ink-muted">
                  {PROJECT_STATUS_LABEL[p.status as keyof typeof PROJECT_STATUS_LABEL] ?? p.status}
                  {p.unreadMessages + p.unansweredPhotos > 0 && <span className="ml-2 font-semibold text-burgundy">· new from them</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-ink-soft">No projects yet.</p>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setProblem(null);
          try {
            const r = await api<{ id: string }>('/api/studio/projects', { body: { clientId, title } });
            navigate(`/studio/projects/${r.id}`);
          } catch (err) {
            setProblem(errorText(err));
            setBusy(false);
          }
        }}
      >
        <label htmlFor={`${id}-t`} className="grid flex-1 gap-1 text-[0.8125rem] font-semibold text-ink">
          New project
          <input id={`${id}-t`} required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`${field} h-9 font-normal`} />
        </label>
        <button type="submit" disabled={busy || !title.trim()} className={button('secondary', 'sm', 'h-9')}>
          Start it
        </button>
      </form>
      {problem && (
        <p role="alert" data-tone="danger" className="mt-2 text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </p>
      )}
    </section>
  );
}

/**
 * A client asked for their account to be closed. Closing stops the account
 * (no sign-in; every session ends) and keeps every record until a retention
 * policy is approved - nothing is deleted here. Or the request is cancelled
 * (e.g. after talking it through). Only the owner can answer it.
 */
function AccountRequest({ request: r, onDone }: { request: NonNullable<ClientPortalData['accountRequests']>[number]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function answer(action: 'close' | 'cancel') {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/studio/account-requests/${r.id}`, { method: 'PATCH', body: { action } });
      onDone();
    } catch (e) {
      setProblem(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div data-tone="attention" className="mt-3 grid gap-2 rounded-(--studio-r-md) bg-(--st-bg) p-3">
      <p className="text-[0.875rem] font-semibold text-(--st-fg)">They asked for their account to be closed · {new Date(r.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
      {r.reason && <p className="text-[0.875rem] text-ink">“{r.reason}”</p>}
      <p className="text-[0.8125rem] text-ink-soft">Closing stops their account (no sign-in) and keeps every record - nothing is deleted until a retention policy is approved.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void answer('close')} className={button('secondary', 'sm')}>
          Close the account
        </button>
        <button type="button" disabled={busy} onClick={() => void answer('cancel')} className={button('ghost', 'sm')}>
          Cancel the request
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-[0.8125rem] font-semibold text-burgundy">
          {problem}
        </p>
      )}
    </div>
  );
}
