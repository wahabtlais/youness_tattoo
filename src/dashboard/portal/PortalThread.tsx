import { useId, useState, type FormEvent } from 'react';
import { cx } from '../../lib/cx';
import { api, errorText } from '../api';
import { ago, fullDate } from '../format';
import { button, field } from '../ui';

export interface PortalMessage {
  id: string;
  from: 'studio' | 'client';
  body: string;
  at: string;
}

/**
 * The conversation with a client, as they see it in their account - so
 * everything written here reaches them (they're emailed that a message is
 * waiting, never what it says). Private notes stay in Notes.
 */
export function PortalThread({ messages, postTo, onSent, clientName, now }: { messages: PortalMessage[]; postTo: string; onSent: () => void; clientName: string; now: Date }) {
  const id = useId();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(postTo, { body: { body } });
      setBody('');
      onSent();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-[0.9375rem] text-ink-soft">No messages yet.</p>
      ) : (
        <ol className="grid gap-2" aria-label={`Conversation with ${clientName}`}>
          {messages.map((m) => (
            <li key={m.id} className={cx('rounded-(--studio-r-md) border p-3', m.from === 'studio' ? 'border-rule bg-(--studio-sunken)' : 'border-burgundy/35 bg-(--studio-raised)')}>
              <p className="text-[0.75rem] font-semibold text-ink-muted">
                <span className={m.from === 'client' ? 'text-burgundy' : 'text-ink'}>{m.from === 'client' ? clientName : 'You'}</span> ·{' '}
                <time dateTime={m.at} title={fullDate(m.at)}>
                  {ago(now, m.at)}
                </time>
              </p>
              <p className="mt-1 text-[0.9375rem] leading-snug whitespace-pre-line text-ink">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={send} className="mt-3 grid gap-2">
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink">
          Write to {clientName.split(' ')[0]} <span className="font-normal text-ink-muted">- they see this in their account</span>
        </label>
        <textarea id={id} rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} className={cx(field, 'py-2')} />
        {problem && (
          <p role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
            {problem}
          </p>
        )}
        <div>
          <button type="submit" disabled={busy || !body.trim()} className={button('primary', 'sm')}>
            {busy ? 'Sending…' : 'Send to client'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** a client account's standing, in a word or two */
export function AccountLine({ account }: { account: { email: string; verified: boolean; createdAt: string } | null }) {
  if (!account) return <span className="text-[0.8125rem] text-ink-muted">No client account - they can’t see messages yet</span>;
  return (
    <span data-tone={account.verified ? 'success' : 'attention'} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-(--st-fg)">
      {account.verified ? 'Client account · verified' : 'Client account · email not confirmed'}
    </span>
  );
}
