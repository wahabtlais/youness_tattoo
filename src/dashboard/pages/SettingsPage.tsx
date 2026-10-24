import { useState, type ReactNode } from 'react';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { api, ApiError, errorText } from '../api';
import { PageHeader } from '../components/PageHeader';
import { ago, fullDate } from '../format';
import { button, field } from '../ui';
import { useResource } from '../useResource';

interface Settings {
  studioName: string;
  timezone: string;
  notifyEmail: string | null;
  retentionMonths: number;
  aiDailyBudgetUsd: number;
  aiMonthlyBudgetUsd: number;
}
interface OutboxRow {
  id: string;
  to: string;
  template: string;
  subject: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  sendAfter: string;
}
interface SessionRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

function Card({ id, title, summary, children }: { id: string; title: string; summary?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="studio-card p-5">
      <h2 id={id} className="type-heading text-[1.1rem]">
        {title}
      </h2>
      {summary && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{summary}</p>}
      {children}
    </section>
  );
}

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return (
    <p role={note.ok ? 'status' : 'alert'} data-tone={note.ok ? 'success' : 'danger'} className="text-[0.8125rem] font-semibold text-(--st-fg)">
      {note.text}
    </p>
  );
}

const label = 'grid gap-1 text-[0.8125rem] font-semibold text-ink-soft';
const problemOf = (e: unknown) => (e instanceof ApiError && Object.keys(e.fields).length ? `${e.message} ${Object.values(e.fields).join(' ')}` : errorText(e));

/**
 * /studio/settings - the studio's own settings (name, time zone, where
 * new-inquiry notices go, how long closed records are kept, the
 * assistant's spending limits), the email the server has sent or is
 * trying to send (a failed one can be retried; nothing is sent from
 * here otherwise), and the account: password and signed-in devices.
 */
export function SettingsPage() {
  useDocumentTitle('Settings');
  const settings = useResource<Settings>('/api/studio/settings');
  if (!settings.data) return settings.error ? <StateMessage kind="error" title={settings.error} /> : <StateMessage kind="loading" title="Loading the settings…" />;
  return (
    <div className="grid gap-5">
      <PageHeader title="Settings" summary="The studio, its email, and your account." demo={false} />
      <div className="grid items-start gap-5 @min-[72rem]:grid-cols-2">
        <StudioCard s={settings.data} onSaved={() => void settings.reload()} />
        <div className="grid gap-5">
          <PasswordCard />
          <SessionsCard />
        </div>
      </div>
      <OutboxCard />
    </div>
  );
}

function StudioCard({ s, onSaved }: { s: Settings; onSaved: () => void }) {
  const [form, setForm] = useState({ ...s, notifyEmail: s.notifyEmail ?? '' });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNote(null);
    try {
      await api('/api/studio/settings', {
        method: 'PATCH',
        body: { ...form, notifyEmail: form.notifyEmail.trim() || null, retentionMonths: Number(form.retentionMonths), aiDailyBudgetUsd: Number(form.aiDailyBudgetUsd), aiMonthlyBudgetUsd: Number(form.aiMonthlyBudgetUsd) },
      });
      setNote({ ok: true, text: 'Saved.' });
      onSaved();
    } catch (err) {
      setNote({ ok: false, text: problemOf(err) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card id="setStudio" title="The studio">
      <form onSubmit={save} className="mt-4 grid gap-3">
        <label className={label}>
          Studio name
          <input type="text" required maxLength={120} value={form.studioName} onChange={(e) => setForm({ ...form, studioName: e.target.value })} className={cx(field, 'min-h-10')} />
        </label>
        <label className={label}>
          Time zone <span className="font-normal text-ink-muted">e.g. Europe/Berlin - used for opening hours</span>
          <input type="text" required maxLength={64} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={cx(field, 'min-h-10')} />
        </label>
        <label className={label}>
          Send new-inquiry notices to <span className="font-normal text-ink-muted">leave empty for none</span>
          <input type="email" maxLength={254} value={form.notifyEmail} onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })} className={cx(field, 'min-h-10')} />
        </label>
        <label className={label}>
          Keep closed clients for (months)
          <input type="number" required min={1} max={120} value={form.retentionMonths} onChange={(e) => setForm({ ...form, retentionMonths: Number(e.target.value) })} className={cx(field, 'min-h-10')} />
          <span className="font-normal text-ink-muted">After this, a client whose inquiries are all declined or completed has their contact details and ideas removed. The counts stay.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Assistant: per day (USD)
            <input type="number" required min={0} max={1000} step={0.01} value={form.aiDailyBudgetUsd} onChange={(e) => setForm({ ...form, aiDailyBudgetUsd: Number(e.target.value) })} className={cx(field, 'min-h-10')} />
          </label>
          <label className={label}>
            Per month (USD)
            <input type="number" required min={0} max={10000} step={0.01} value={form.aiMonthlyBudgetUsd} onChange={(e) => setForm({ ...form, aiMonthlyBudgetUsd: Number(e.target.value) })} className={cx(field, 'min-h-10')} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className={button('primary', 'sm')}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <Note note={note} />
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current: '', password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setNote({ ok: false, text: 'The new passwords don’t match.' });
    setSaving(true);
    setNote(null);
    try {
      await api('/api/auth/password/change', { body: { current: form.current, password: form.password } });
      setForm({ current: '', password: '', confirm: '' });
      setNote({ ok: true, text: 'Password changed. Other devices were signed out.' });
    } catch (err) {
      setNote({ ok: false, text: problemOf(err) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card id="setPassword" title="Password" summary="At least 12 characters. A passphrase is easiest to remember.">
      <form onSubmit={save} className="mt-4 grid gap-3">
        {(
          [
            ['current', 'Current password', 'current-password'],
            ['password', 'New password', 'new-password'],
            ['confirm', 'New password, again', 'new-password'],
          ] as const
        ).map(([k, l, ac]) => (
          <label key={k} className={label}>
            {l}
            <input type="password" required minLength={k === 'current' ? 1 : 12} maxLength={128} autoComplete={ac} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={cx(field, 'min-h-10')} />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className={button('primary', 'sm')}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
          <Note note={note} />
        </div>
      </form>
    </Card>
  );
}

const device = (ua: string | null) => {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

function SessionsCard() {
  const sessions = useResource<SessionRow[]>('/api/auth/sessions');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (key: string, f: () => Promise<unknown>) => {
    setBusy(key);
    setNote(null);
    try {
      await f();
      await sessions.reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  const now = new Date();
  const others = sessions.data?.filter((s) => !s.current) ?? [];
  return (
    <Card id="setSessions" title="Signed-in devices">
      {!sessions.data ? (
        <p className="mt-2 text-[0.875rem] text-ink-muted">{sessions.error ?? 'Loading…'}</p>
      ) : (
        <>
          <ul className="mt-3 grid gap-2">
            {sessions.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-semibold text-ink">
                    {device(s.userAgent)}
                    {s.current && <span className="ml-2 text-[0.75rem] font-medium text-burgundy">This device</span>}
                  </span>
                  <span className="block text-[0.75rem] text-ink-muted" title={fullDate(s.createdAt)}>
                    Active {ago(now, s.lastSeenAt)}
                    {s.ip ? ` · ${s.ip}` : ''}
                  </span>
                </span>
                {!s.current && (
                  <button type="button" disabled={!!busy} onClick={() => void run(s.id, () => api(`/api/auth/sessions/${s.id}`, { method: 'DELETE' }))} className={button('ghost', 'sm')}>
                    {busy === s.id ? 'Signing out…' : 'Sign out'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {others.length > 0 && (
            <button type="button" disabled={!!busy} onClick={() => void run('all', () => api('/api/auth/sessions/revoke-others', { method: 'POST' }))} className={cx(button('secondary', 'sm'), 'mt-3')}>
              {busy === 'all' ? 'Signing out…' : 'Sign out every other device'}
            </button>
          )}
          <div className="mt-2">
            <Note note={note} />
          </div>
        </>
      )}
    </Card>
  );
}

const STATUS: Record<OutboxRow['status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting to send', tone: 'info' },
  sending: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

function OutboxCard() {
  const outbox = useResource<OutboxRow[]>('/api/studio/outbox');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const now = new Date();
  const retry = async (id: string) => {
    setBusy(id);
    setNote(null);
    try {
      await api(`/api/studio/outbox/${id}/retry`, { method: 'POST' });
      setNote({ ok: true, text: 'Queued again - the server tries it within a minute.' });
      await outbox.reload();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  const failed = outbox.data?.filter((m) => m.status === 'failed').length ?? 0;
  return (
    <Card id="setOutbox" title="Email" summary={`The server’s outgoing email - new-inquiry notices to you, the receipt a client gets for their own consultation, and password resets. ${failed ? `${failed} failed.` : 'Nothing has failed.'} Nothing else is emailed to clients automatically.`}>
      {!outbox.data ? (
        <p className="mt-2 text-[0.875rem] text-ink-muted">{outbox.error ?? 'Loading…'}</p>
      ) : outbox.data.length === 0 ? (
        <p className="mt-3 text-[0.9375rem] text-ink-soft">No email yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.875rem]">
            <thead className="text-[0.75rem] text-ink-muted">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-semibold">Subject</th>
                <th className="py-2 pr-3 font-semibold">To</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {outbox.data.map((m) => (
                <tr key={m.id} className="align-top">
                  <td className="py-2 pr-3 text-ink">{m.subject}</td>
                  <td className="py-2 pr-3 text-ink-soft">{m.to}</td>
                  <td className="py-2 pr-3">
                    <span data-tone={STATUS[m.status].tone} className="font-semibold text-(--st-fg)">
                      {STATUS[m.status].label}
                    </span>
                    <span className="block text-[0.75rem] text-ink-muted">
                      {m.attempts} of {m.maxAttempts} tries
                    </span>
                    {m.lastError && m.status !== 'sent' && <span className="block max-w-[22rem] text-[0.75rem] break-words text-ink-muted">{m.lastError}</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-muted" title={fullDate(m.sentAt ?? m.createdAt)}>
                    {ago(now, m.sentAt ?? m.createdAt)}
                  </td>
                  <td className="py-2 text-right">
                    {m.status === 'failed' && (
                      <button type="button" disabled={!!busy} onClick={() => void retry(m.id)} className={button('secondary', 'sm')}>
                        {busy === m.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2">
        <Note note={note} />
      </div>
    </Card>
  );
}
