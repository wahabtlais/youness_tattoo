import { useState } from 'react';
import { cx } from '../../lib/cx';
import { api, ApiError, errorText } from '../api';
import { DashIcon } from '../DashIcon';
import { localDay, type ClientRecord } from '../records';
import type { Appointment, AppointmentKind } from '../types';
import { button, field } from '../ui';
import { reloadOverview } from '../useOverview';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS: { value: AppointmentKind; label: string; minutes: number }[] = [
  { value: 'consultation', label: 'Consultation', minutes: 30 },
  { value: 'session', label: 'Session', minutes: 180 },
  { value: 'aftercare', label: 'Aftercare', minutes: 20 },
];

/**
 * A new appointment. The database refuses one that overlaps another
 * proposed or confirmed appointment - that refusal is shown as it comes,
 * nothing is booked twice. Nobody is told automatically.
 */
export function NewAppointment({ clients, day, onDone, onCancel }: { clients: ClientRecord[]; day: Date; onDone: (startsAt: string) => void; onCancel: () => void }) {
  const choosable = clients.filter((c) => UUID.test(c.id));
  const [form, setForm] = useState({ clientId: choosable[0]?.id ?? '', kind: 'consultation' as AppointmentKind, title: '', date: localDay(day), time: '11:00', minutes: 30, status: 'proposed' as 'proposed' | 'confirmed', prep: '' });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(start.getTime())) return setProblem('Choose a date and time.');
    const end = new Date(start.getTime() + form.minutes * 60_000);
    const client = choosable.find((c) => c.id === form.clientId);
    setSaving(true);
    setProblem(null);
    try {
      await api('/api/studio/appointments', {
        body: {
          clientId: form.clientId,
          inquiryId: client?.inquiries[0]?.id,
          kind: form.kind,
          title: form.title.trim() || `${KINDS.find((k) => k.value === form.kind)!.label} · ${client?.name ?? ''}`.trim(),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          status: form.status,
          prep: form.prep.trim() || undefined,
        },
      });
      void reloadOverview();
      onDone(start.toISOString());
    } catch (err) {
      setProblem(err instanceof ApiError && err.code === 'validation' && Object.keys(err.fields).length ? Object.values(err.fields).join(' ') : errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const label = 'grid gap-1 text-[0.8125rem] font-semibold text-ink-soft';
  return (
    <section aria-labelledby="newAppt" className="studio-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 id="newAppt" className="type-heading text-[1.1rem]">
          New appointment
        </h2>
        <button type="button" onClick={onCancel} aria-label="Close" className={button('ghost', 'sm', 'px-2')}>
          <DashIcon name="close" />
        </button>
      </div>
      {choosable.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] text-ink-soft">There’s no client on record yet. A client appears here once their inquiry arrives.</p>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <label className={label}>
            Client
            <select value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className={cx(field, 'min-h-10')}>
              {choosable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Kind
            <select
              value={form.kind}
              onChange={(e) => {
                const k = KINDS.find((x) => x.value === e.target.value)!;
                setForm((f) => ({ ...f, kind: k.value, minutes: k.minutes }));
              }}
              className={cx(field, 'min-h-10')}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Date
              <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} className={cx(field, 'min-h-10')} />
            </label>
            <label className={label}>
              Starts
              <input type="time" required step={900} value={form.time} onChange={(e) => set('time', e.target.value)} className={cx(field, 'min-h-10')} />
            </label>
          </div>
          <label className={label}>
            Length (minutes)
            <input type="number" required min={10} max={720} step={5} value={form.minutes} onChange={(e) => set('minutes', Number(e.target.value))} className={cx(field, 'min-h-10')} />
          </label>
          <label className={label}>
            Title <span className="font-normal text-ink-muted">(optional)</span>
            <input type="text" maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} className={cx(field, 'min-h-10')} placeholder="Session 1 of 2 · forearm" />
          </label>
          <label className={label}>
            To prepare <span className="font-normal text-ink-muted">(optional)</span>
            <input type="text" maxLength={300} value={form.prep} onChange={(e) => set('prep', e.target.value)} className={cx(field, 'min-h-10')} />
          </label>
          <fieldset className="grid gap-1">
            <legend className="text-[0.8125rem] font-semibold text-ink-soft">Status</legend>
            <div className="flex gap-4 text-[0.875rem]">
              {(['proposed', 'confirmed'] as const).map((s) => (
                <label key={s} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="apptStatus" checked={form.status === s} onChange={() => set('status', s)} />
                  {s === 'proposed' ? 'To confirm' : 'Confirmed'}
                </label>
              ))}
            </div>
          </fieldset>
          {problem && (
            <p role="alert" data-tone="danger" className="rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-(--st-fg)">
              {problem}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.clientId} className={button('primary', 'sm')}>
              {saving ? 'Booking…' : 'Book it'}
            </button>
            <button type="button" onClick={onCancel} className={button('ghost', 'sm')}>
              Cancel
            </button>
          </div>
          <p className="text-[0.75rem] text-ink-muted">The client isn’t told automatically.</p>
        </form>
      )}
    </section>
  );
}

/** confirm, mark done, or cancel one appointment */
export function ApptActions({ a, now, onChanged }: { a: Appointment; now: Date; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const change = async (status: Appointment['status']) => {
    if (status === 'cancelled' && !window.confirm('Cancel this appointment? It frees the time; the record is kept.')) return;
    setBusy(status);
    setProblem(null);
    try {
      await api(`/api/studio/appointments/${a.id}`, { method: 'PATCH', body: { status } });
      void reloadOverview();
      onChanged();
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const past = new Date(a.endsAt) < now;
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <div className="flex flex-wrap gap-2">
        {a.status === 'proposed' && (
          <button type="button" disabled={!!busy} onClick={() => void change('confirmed')} className={button('primary', 'sm')}>
            {busy === 'confirmed' ? 'Saving…' : 'Confirm'}
          </button>
        )}
        {past && (
          <button type="button" disabled={!!busy} onClick={() => void change('completed')} className={button('secondary', 'sm')}>
            {busy === 'completed' ? 'Saving…' : 'Mark done'}
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => void change('cancelled')} className={button('ghost', 'sm')}>
          {busy === 'cancelled' ? 'Cancelling…' : 'Cancel appointment'}
        </button>
      </div>
      {problem && (
        <p role="alert" data-tone="danger" className="mt-2 text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </p>
      )}
      <p className="mt-2 text-[0.75rem] text-ink-muted">Changes are saved. The client isn’t told automatically.</p>
    </div>
  );
}
