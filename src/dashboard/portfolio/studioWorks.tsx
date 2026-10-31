import { useRef, useState } from 'react';
import type { TattooWork } from '../../domain/work';
import { cx } from '../../lib/cx';
import { api, ApiError, errorText } from '../api';
import { DashIcon } from '../DashIcon';
import type { WorkRow } from './useStudioWorks';
import { button, field } from '../ui';

/** a piece as the studio sees it: the public shape, plus whether it's on the site */
export type StudioWork = TattooWork & { uuid: string; published: boolean; description: string | null };

/**
 * Add a piece: the image is checked (its real type, not its name), its
 * location and camera data stripped, and sized for the site; the piece
 * starts private - it reaches the site once you publish it.
 */
export function UploadPanel({ onDone, onCancel }: { onDone: (number: string | null) => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setProblem('Choose an image first.');
    setBusy(true);
    setProblem(null);
    try {
      const form = new FormData();
      // fields before the file, so the server reads them with it
      form.append('alt', alt);
      form.append('file', file);
      const media = await api<{ id: string }>('/api/studio/media?visibility=public', { form });
      const { id } = await api<{ id: string }>('/api/studio/works', { body: { mediaId: media.id, alt, title: title.trim() || undefined } });
      const works = await api<WorkRow[]>('/api/studio/works');
      onDone(works.find((w) => w.id === id)?.number ?? null);
    } catch (err) {
      setProblem(err instanceof ApiError && Object.keys(err.fields).length ? `${err.message} ${Object.values(err.fields).join(' ')}` : errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const label = 'grid gap-1 text-[0.8125rem] font-semibold text-ink-soft';
  return (
    <section aria-labelledby="uploadTitle" className="studio-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 id="uploadTitle" className="type-heading text-[1.1rem]">
          Add a piece
        </h2>
        <button type="button" onClick={onCancel} aria-label="Close" className={button('ghost', 'sm', 'px-2')}>
          <DashIcon name="close" />
        </button>
      </div>
      <form onSubmit={submit} className="mt-3 grid gap-3">
        <label className={label}>
          Photograph <span className="font-normal text-ink-muted">JPEG, PNG, WebP or AVIF · up to 20 MB</span>
          <input ref={input} type="file" required accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={cx(field, 'min-h-10 py-1.5')} />
        </label>
        <label className={label}>
          Describe the photograph <span className="font-normal text-ink-muted">for people using a screen reader</span>
          <input type="text" required maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} className={cx(field, 'min-h-10')} placeholder="Black and grey rose on the forearm" />
        </label>
        <label className={label}>
          Title <span className="font-normal text-ink-muted">(optional)</span>
          <input type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={cx(field, 'min-h-10')} />
        </label>
        {problem && (
          <p role="alert" data-tone="danger" className="rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-(--st-fg)">
            {problem}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={button('primary', 'sm')}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
          <button type="button" onClick={onCancel} className={button('ghost', 'sm')}>
            Cancel
          </button>
        </div>
        <p className="text-[0.75rem] text-ink-muted">Location and camera details are removed. The piece stays private until you publish it.</p>
      </form>
    </section>
  );
}

/** title, description, alt text, whether the details are confirmed, and whether it's on the site */
export function PieceEditor({ w, onSaved }: { w: StudioWork; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: w.title, alt: w.alt, description: w.description ?? '', verified: w.metadataStatus === 'verified' });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const patch = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setProblem(null);
    try {
      await api(`/api/studio/works/${w.uuid}`, { method: 'PATCH', body });
      onSaved();
      return true;
    } catch (e) {
      setProblem(errorText(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const label = 'grid gap-1 text-[0.8125rem] font-semibold text-ink-soft';
  return (
    <div className="mt-3 grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span data-tone={w.published ? 'success' : 'neutral'} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-(--st-bg) px-2.5 text-[0.8125rem] font-semibold text-(--st-fg)">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
          {w.published ? 'On the site' : 'Private'}
        </span>
        <button type="button" disabled={!!busy} onClick={() => void patch('pub', { published: !w.published })} className={button(w.published ? 'secondary' : 'primary', 'sm')}>
          {busy === 'pub' ? 'Saving…' : w.published ? 'Take off the site' : 'Publish to the site'}
        </button>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={button('secondary', 'sm')}>
            Edit details
          </button>
        )}
      </div>
      {editing && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await patch('edit', { title: form.title, alt: form.alt, description: form.description.trim() || null, metadataStatus: form.verified ? 'verified' : 'demo' });
            if (ok) setEditing(false);
          }}
          className="grid gap-3 rounded-(--studio-r-md) bg-(--studio-sunken) p-3"
        >
          <label className={label}>
            Title
            <input type="text" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={cx(field, 'min-h-10')} />
          </label>
          <label className={label}>
            Describe the photograph
            <input type="text" required maxLength={300} value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} className={cx(field, 'min-h-10')} />
          </label>
          <label className={label}>
            Description <span className="font-normal text-ink-muted">(optional, shown once confirmed)</span>
            <textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cx(field, 'py-2')} />
          </label>
          <label className="inline-flex items-start gap-2 text-[0.875rem] text-ink">
            <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="mt-1" />
            <span>
              These details are confirmed
              <span className="block text-[0.8125rem] text-ink-muted">Only confirmed details are stated on the site as facts about the piece.</span>
            </span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy} className={button('primary', 'sm')}>
              {busy === 'edit' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={button('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {problem && (
        <p role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </p>
      )}
    </div>
  );
}
