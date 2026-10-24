import { useId, useState } from 'react';
import { cx } from '../../lib/cx';
import { api, ApiError, errorText } from '../api';
import { ago, dayName, daysFrom, fullDate, plural } from '../format';
import { button, field } from '../ui';
import { reloadOverview } from '../useOverview';

const FOLLOW = { reply: 'Reply owed', reminder: 'Reminder', aftercare: 'Aftercare' } as const;
type FollowKind = keyof typeof FOLLOW;

/** the client's own record, beyond what the overview carries */
export interface ClientDetailData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  preferredContact: 'email' | 'phone' | 'instagram' | null;
  demo: boolean;
  anonymized: boolean;
  createdAt: string;
  notes: { id: string; body: string; source: 'user' | 'assistant'; createdAt: string }[];
  followUps: { id: string; kind: FollowKind; reason: string; dueAt: string; doneAt: string | null; inquiryId: string | null; demo: boolean }[];
  activity: { id: string; at: string; actor: string; text: string }[];
}

function Card({ id, title, aside, children }: { id: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="studio-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="type-heading text-[1.05rem]">
          {title}
        </h3>
        {aside && <span className="text-[0.8125rem] text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" data-tone="danger" className="mt-2 text-[0.8125rem] font-semibold text-(--st-fg)">
      {text}
    </p>
  );
}

/** how to reach them: the email they gave (fixed - it identifies them), and phone/Instagram you can correct */
export function ContactCard({ c, onSaved }: { c: ClientDetailData; onSaved: () => void }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: c.name, phone: c.phone ?? '', instagram: c.instagram ?? '', preferredContact: c.preferredContact ?? '' });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (c.anonymized) {
    return (
      <Card id={`${id}-h`} title="Contact">
        <p className="mt-2 text-[0.9375rem] leading-snug text-ink-soft">Removed under the retention policy - this record keeps no contact details.</p>
      </Card>
    );
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      await api(`/api/studio/clients/${c.id}`, {
        method: 'PATCH',
        body: { name: form.name, phone: form.phone || null, instagram: form.instagram || null, preferredContact: form.preferredContact || null },
      });
      setEditing(false);
      onSaved();
      void reloadOverview();
    } catch (err) {
      setProblem(err instanceof ApiError && Object.keys(err.fields).length ? Object.values(err.fields).join(' ') : errorText(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card id={`${id}-h`} title="Contact" aside={c.demo ? 'Sample' : undefined}>
      {editing ? (
        <form onSubmit={save} className="mt-3 grid gap-3">
          {(
            [
              ['name', 'Name', 'text'],
              ['phone', 'Phone', 'tel'],
              ['instagram', 'Instagram', 'text'],
            ] as const
          ).map(([k, label, type]) => (
            <label key={k} className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
              {label}
              <input type={type} value={form[k]} required={k === 'name'} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={cx(field, 'min-h-10')} />
            </label>
          ))}
          <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
            Prefers
            <select value={form.preferredContact} onChange={(e) => setForm({ ...form, preferredContact: e.target.value })} className={cx(field, 'min-h-10')}>
              <option value="">No preference</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <Problem text={problem} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={button('primary', 'sm')}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={button('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[0.9375rem]">
            <dt className="text-ink-muted">Email</dt>
            <dd className="min-w-0 truncate">
              {c.email ? (
                <a href={`mailto:${c.email}`} className="font-medium text-burgundy underline-offset-4 hover:underline">
                  {c.email}
                </a>
              ) : (
                <span className="text-ink-muted">{c.demo ? 'None - a sample record' : 'Not given'}</span>
              )}
            </dd>
            <dt className="text-ink-muted">Phone</dt>
            <dd>{c.phone ?? <span className="text-ink-muted">Not given</span>}</dd>
            <dt className="text-ink-muted">Instagram</dt>
            <dd>{c.instagram ? `@${c.instagram}` : <span className="text-ink-muted">Not given</span>}</dd>
            {c.preferredContact && (
              <>
                <dt className="text-ink-muted">Prefers</dt>
                <dd className="capitalize">{c.preferredContact}</dd>
              </>
            )}
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-ink-muted">On record since {fullDate(c.createdAt)}</p>
            <button type="button" onClick={() => setEditing(true)} className={button('secondary', 'sm')}>
              Edit
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/** what's owed them: mark done, or add one */
export function FollowUpsCard({ c, now, onChanged }: { c: ClientDetailData; now: Date; onChanged: () => void }) {
  const id = useId();
  const open = c.followUps.filter((f) => !f.doneAt);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ kind: FollowKind; reason: string; due: string }>({ kind: 'reply', reason: '', due: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (key: string, f: () => Promise<unknown>) => {
    setBusy(key);
    setProblem(null);
    try {
      await f();
      onChanged();
      void reloadOverview();
      return true;
    } catch (e) {
      setProblem(errorText(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const due = new Date(`${form.due}T10:00`);
    if (Number.isNaN(due.getTime())) return setProblem('Choose a due date.');
    const ok = await run('add', () => api('/api/studio/follow-ups', { body: { clientId: c.id, kind: form.kind, reason: form.reason, dueAt: due.toISOString() } }));
    if (ok) {
      setAdding(false);
      setForm({ kind: 'reply', reason: '', due: '' });
    }
  };

  return (
    <Card id={`${id}-h`} title="Follow-ups" aside={open.length ? plural(open.length, 'open') : undefined}>
      {open.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] text-ink-soft">Nothing owed.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {open.map((f) => {
            const d = daysFrom(now, f.dueAt);
            const tone = d < 0 ? 'danger' : d === 0 ? 'attention' : 'info';
            return (
              <li key={f.id} data-tone={tone} className="relative flex items-center gap-3 overflow-hidden rounded-(--studio-r-md) border border-rule py-2.5 pr-3 pl-4">
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--st-solid)" />
                <span className="min-w-0 flex-1">
                  <span className="text-[0.75rem] font-bold text-(--st-fg)">
                    {FOLLOW[f.kind]} · {d < 0 ? `${plural(-d, 'day')} overdue` : d === 0 ? 'due today' : `due ${dayName(now, f.dueAt).toLowerCase()}`}
                  </span>
                  <span className="block text-[0.9375rem] text-ink">{f.reason}</span>
                </span>
                <button type="button" disabled={!!busy} onClick={() => void run(f.id, () => api(`/api/studio/follow-ups/${f.id}`, { method: 'PATCH', body: { done: true } }))} className={button('secondary', 'sm')}>
                  {busy === f.id ? 'Saving…' : 'Done'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <form onSubmit={add} className="mt-3 grid gap-3 rounded-(--studio-r-md) bg-(--studio-sunken) p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
              Kind
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FollowKind })} className={cx(field, 'min-h-10')}>
                {(Object.keys(FOLLOW) as FollowKind[]).map((k) => (
                  <option key={k} value={k}>
                    {FOLLOW[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
              Due
              <input type="date" required value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className={cx(field, 'min-h-10')} />
            </label>
          </div>
          <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
            What for
            <input type="text" required maxLength={300} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={cx(field, 'min-h-10')} placeholder="Send the sketch revision" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy} className={button('primary', 'sm')}>
              {busy === 'add' ? 'Adding…' : 'Add follow-up'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className={button('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        !c.anonymized && (
          <button type="button" onClick={() => setAdding(true)} className={cx(button('ghost', 'sm'), 'mt-3')}>
            Add a follow-up
          </button>
        )
      )}
      <Problem text={problem} />
    </Card>
  );
}

/** private notes on the person (an inquiry's own notes stay with the inquiry) */
export function ClientNotesCard({ c, onChanged }: { c: ClientDetailData; onChanged: () => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setProblem(null);
    try {
      await api(`/api/studio/clients/${c.id}/notes`, { body: { body: text.trim() } });
      setText('');
      onChanged();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card id={`${id}-h`} title="Private notes" aside="Only you · saved">
      {c.notes.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {c.notes.map((n) => (
            <li key={n.id} className="rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2 text-[0.9375rem] leading-snug whitespace-pre-wrap text-ink">
              {n.body}
              <span className="mt-0.5 block text-[0.75rem] text-ink-muted">{ago(new Date(), n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {!c.anonymized && (
        <form onSubmit={add} className="mt-3 grid gap-2">
          <label htmlFor={`${id}-n`} className="sr-only">
            New note
          </label>
          <textarea id={`${id}-n`} rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={cx(field, 'min-h-16 py-2')} placeholder="Something to remember about them" />
          <button type="submit" disabled={!text.trim() || saving} className={cx(button('secondary', 'sm'), 'w-fit')}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </form>
      )}
      <Problem text={problem} />
    </Card>
  );
}

/** what happened with them, newest first - from the studio's history */
export function ClientHistoryCard({ c, now }: { c: ClientDetailData; now: Date }) {
  const id = useId();
  if (c.activity.length === 0) return null;
  return (
    <Card id={`${id}-h`} title="History">
      <ol className="mt-3 grid gap-2">
        {c.activity.map((a) => (
          <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[0.875rem]">
            <span className="text-ink-soft">{a.text}</span>
            <time dateTime={a.at} title={fullDate(a.at)} className="text-[0.75rem] whitespace-nowrap text-ink-muted">
              {ago(now, a.at)}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}
