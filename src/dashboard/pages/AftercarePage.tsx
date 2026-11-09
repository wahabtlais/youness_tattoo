import { useId, useState, type FormEvent } from 'react';
import { cx } from '../../lib/cx';
import { api, errorText } from '../api';
import { PageHeader } from '../components/PageHeader';
import { fullDate } from '../format';
import { button, field } from '../ui';
import { useResource } from '../useResource';

interface Step {
  dayFrom: number;
  dayTo: number | null;
  title: string;
  body: string;
}
interface Guide {
  id: string;
  title: string;
  intro: string | null;
  approved: boolean;
  approvedAt: string | null;
  updatedAt: string;
  usedBy: number;
  steps: Step[];
}

const blank = (): Step => ({ dayFrom: 0, dayTo: null, title: '', body: '' });

/**
 * Aftercare guides - written by Younes, in his words, stage by stage over
 * the days of healing. Nothing here is written for him and nothing reaches
 * a client until he approves it; saving a change takes the approval away
 * again. A guide given to a client is copied as it read then, so editing
 * one later never changes what a healing client already has.
 */
export function AftercarePage() {
  const guides = useResource<Guide[]>('/api/studio/aftercare/guides');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const current = editing && editing !== 'new' ? guides.data?.find((g) => g.id === editing) : undefined;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Aftercare"
        summary="Your aftercare instructions, by the days of healing. Only what you approve can be given to a client - and the site never writes instructions for you."
        demo={false}
        actions={
          <button type="button" className={button('primary')} onClick={() => setEditing('new')}>
            New guide
          </button>
        }
      />
      <div className="grid items-start gap-5 @min-[64rem]:grid-cols-[20rem_minmax(0,1fr)]">
        <section aria-label="Guides" className="studio-card p-0">
          {!guides.data ? (
            <p role="status" className="p-5 text-ink-muted">
              {guides.error ?? 'Loading…'}
            </p>
          ) : guides.data.length === 0 ? (
            <p className="p-5 text-[0.9375rem] text-ink-soft">No guides yet. Write your first one - your own instructions, stage by stage.</p>
          ) : (
            <ul>
              {guides.data.map((g) => (
                <li key={g.id} className="border-b border-rule last:border-b-0">
                  <button type="button" onClick={() => setEditing(g.id)} aria-current={editing === g.id ? 'true' : undefined} className="block w-full px-5 py-4 text-left hover:bg-(--studio-hover) aria-[current=true]:bg-(--studio-selected)">
                    <span className="block text-[0.9375rem] font-semibold text-ink">{g.title}</span>
                    <span data-tone={g.approved ? 'success' : 'attention'} className="text-[0.75rem] font-semibold text-(--st-fg)">
                      {g.approved ? 'Approved' : 'Not approved - can’t be given yet'}
                    </span>
                    <span className="block text-[0.75rem] text-ink-muted">
                      {g.steps.length} stage{g.steps.length === 1 ? '' : 's'} · given to {g.usedBy} piece{g.usedBy === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {editing ? (
          <Editor key={editing} guide={current} onSaved={(id) => {
            void guides.reload();
            setEditing(id);
          }} onDeleted={() => {
            void guides.reload();
            setEditing(null);
          }} />
        ) : (
          <p className="studio-card p-5 text-[0.9375rem] text-ink-soft">Choose a guide to read or edit it, or write a new one.</p>
        )}
      </div>
    </div>
  );
}

function Editor({ guide, onSaved, onDeleted }: { guide?: Guide; onSaved: (id: string) => void; onDeleted: () => void }) {
  const fid = useId();
  const [title, setTitle] = useState(guide?.title ?? '');
  const [intro, setIntro] = useState(guide?.intro ?? '');
  const [steps, setSteps] = useState<Step[]>(guide?.steps.length ? guide.steps : [blank()]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [changed, setChanged] = useState(false);
  const edit = (i: number, patch: Partial<Step>) => {
    setChanged(true);
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      const body = { title, intro: intro || null, steps: steps.map((s) => ({ ...s, dayTo: s.dayTo ?? null })) };
      const r = guide ? await api<{ id: string }>(`/api/studio/aftercare/guides/${guide.id}`, { method: 'PUT', body }) : await api<{ id: string }>('/api/studio/aftercare/guides', { body });
      setChanged(false);
      onSaved(r.id);
    } catch (err) {
      setProblem(errorText(err));
      if (err && typeof err === 'object' && 'fields' in err) setFields((err as { fields: Record<string, string> }).fields);
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!guide) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/studio/aftercare/guides/${guide.id}/approve`, { method: 'POST' });
      onSaved(guide.id);
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!guide) return;
    setBusy(true);
    try {
      await api(`/api/studio/aftercare/guides/${guide.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setProblem(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="studio-card grid gap-4 p-5" aria-label={guide ? `Edit ${guide.title}` : 'New guide'}>
      {guide && (
        <p data-tone={guide.approved && !changed ? 'success' : 'attention'} className="rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.8125rem] font-semibold text-(--st-fg)">
          {guide.approved && !changed
            ? `Approved ${guide.approvedAt ? fullDate(guide.approvedAt) : ''} - it can be given to clients.`
            : changed
              ? 'Saving a change takes the approval away until you approve it again. Clients who already have it keep the version they were given.'
              : 'Not approved - read it through, then approve it to be able to give it.'}
        </p>
      )}
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink" htmlFor={`${fid}-t`}>
        Title
        <input id={`${fid}-t`} required maxLength={160} value={title} onChange={(e) => (setChanged(true), setTitle(e.target.value))} className={cx(field, 'h-10 font-normal')} placeholder="e.g. Aftercare for a new tattoo" />
      </label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink" htmlFor={`${fid}-i`}>
        A few words first <span className="font-normal text-ink-muted">(optional)</span>
        <textarea id={`${fid}-i`} rows={2} maxLength={2000} value={intro} onChange={(e) => (setChanged(true), setIntro(e.target.value))} className={cx(field, 'py-2 font-normal')} />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-[0.8125rem] font-semibold text-ink">Stages - by the days of healing (day 0 is the session)</legend>
        {steps.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-(--studio-r-md) border border-rule p-3">
            <div className="grid grid-cols-[5rem_5rem_minmax(0,1fr)] gap-2">
              <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted">
                From day
                <input type="number" min={0} max={365} required value={s.dayFrom} onChange={(e) => edit(i, { dayFrom: Number(e.target.value) })} className={cx(field, 'h-9')} />
              </label>
              <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted">
                To day
                <input type="number" min={0} max={365} placeholder="onward" value={s.dayTo ?? ''} onChange={(e) => edit(i, { dayTo: e.target.value === '' ? null : Number(e.target.value) })} className={cx(field, 'h-9')} />
              </label>
              <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted">
                Stage title
                <input required maxLength={160} value={s.title} onChange={(e) => edit(i, { title: e.target.value })} className={cx(field, 'h-9')} />
              </label>
            </div>
            <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted">
              Your instructions for this stage
              <textarea required rows={4} maxLength={6000} value={s.body} onChange={(e) => edit(i, { body: e.target.value })} className={cx(field, 'py-2 text-[0.9375rem]')} />
            </label>
            {fields[`steps.${i}.dayTo`] && <p className="text-[0.75rem] font-semibold text-burgundy">{fields[`steps.${i}.dayTo`]}</p>}
            {steps.length > 1 && (
              <div>
                <button type="button" className={button('ghost', 'sm')} onClick={() => (setChanged(true), setSteps((x) => x.filter((_, j) => j !== i)))}>
                  Remove this stage
                </button>
              </div>
            )}
          </div>
        ))}
        <div>
          <button type="button" className={button('secondary', 'sm')} onClick={() => (setChanged(true), setSteps((x) => [...x, { ...blank(), dayFrom: (x[x.length - 1]?.dayTo ?? x[x.length - 1]?.dayFrom ?? 0) + 1 }]))}>
            Add a stage
          </button>
        </div>
      </fieldset>

      {problem && (
        <p role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button type="submit" disabled={busy} className={button('primary')}>
          {busy ? 'Saving…' : guide ? 'Save changes' : 'Save the guide'}
        </button>
        {guide && !changed && !guide.approved && (
          <button type="button" disabled={busy} onClick={() => void approve()} className={button('secondary')}>
            I’ve read it - approve
          </button>
        )}
        {guide && (
          <button type="button" disabled={busy} data-tone="danger" onClick={() => void remove()} className={button('danger', 'md', 'ml-auto')}>
            Delete guide
          </button>
        )}
      </div>
    </form>
  );
}
