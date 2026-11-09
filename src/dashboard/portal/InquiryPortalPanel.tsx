import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, errorText } from '../api';
import { button, field } from '../ui';
import { useResource } from '../useResource';
import { AccountLine, PortalThread, type PortalMessage } from './PortalThread';

interface PortalSide {
  kind: 'consultation' | 'booking';
  account: { email: string; verified: boolean; createdAt: string } | null;
  project: { id: string; title: string } | null;
  bookingFor: string | null;
  messages: PortalMessage[];
}

/**
 * An inquiry's client-portal side: whether they have an account, the
 * conversation they see, and - once you've accepted it - a project made
 * from it (its idea, placement and size carried over). A booking request
 * links to its project; it becomes an appointment only when you propose one.
 */
export function InquiryPortalPanel({ inquiryId, clientId, clientName, concept, now }: { inquiryId: string; clientId: string; clientName: string; concept?: string; now: Date }) {
  const id = useId();
  const navigate = useNavigate();
  const side = useResource<PortalSide>(`/api/studio/inquiries/${inquiryId}/portal`);
  const [title, setTitle] = useState(concept?.slice(0, 160) ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const s = side.data;

  async function start() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ id: string }>('/api/studio/projects', { body: { clientId, inquiryId, title: title.trim() || 'New project' } });
      navigate(`/studio/projects/${r.id}`);
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="studio-card @container p-[clamp(1rem,1.8vw,1.35rem)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-h`} className="type-heading text-[1.05rem]">
          {s?.kind === 'booking' ? 'Booking request · client account' : 'Client account'}
        </h3>
        {s && <AccountLine account={s.account} />}
      </div>
      {!s ? (
        <p role="status" className="mt-2 text-[0.875rem] text-ink-muted">
          {side.error ?? 'Loading…'}
        </p>
      ) : (
        <div className="mt-3 grid gap-4">
          {s.bookingFor && (
            <p className="text-[0.875rem] text-ink-soft">
              For their project -{' '}
              <Link to={`/studio/projects/${s.bookingFor}`} className="font-semibold text-burgundy underline underline-offset-2">
                open it
              </Link>{' '}
              to propose a session. Nothing is booked until you do.
            </p>
          )}
          {s.project ? (
            <p className="text-[0.875rem] text-ink-soft">
              Project from this request:{' '}
              <Link to={`/studio/projects/${s.project.id}`} className="font-semibold text-burgundy underline underline-offset-2">
                {s.project.title}
              </Link>
            </p>
          ) : (
            s.kind === 'consultation' && (
              <div className="grid gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3">
                <label htmlFor={`${id}-title`} className="text-[0.8125rem] font-semibold text-ink">
                  Start a project from this request
                </label>
                <input id={`${id}-title`} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" className={`${field} h-9`} />
                <p className="text-[0.75rem] text-ink-muted">The idea, placement and size are carried over. The client sees the project in their account.</p>
                {problem && (
                  <p role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
                    {problem}
                  </p>
                )}
                <div>
                  <button type="button" disabled={busy} onClick={() => void start()} className={button('secondary', 'sm')}>
                    {busy ? 'Starting…' : 'Start the project'}
                  </button>
                </div>
              </div>
            )
          )}
          {s.account?.verified ? (
            <PortalThread messages={s.messages} postTo={`/api/studio/inquiries/${inquiryId}/messages`} onSent={() => void side.reload()} clientName={clientName} now={now} />
          ) : (
            <p className="text-[0.875rem] text-ink-muted">Messages here reach a client once they have a verified account. Reply by email until then.</p>
          )}
        </div>
      )}
    </section>
  );
}
