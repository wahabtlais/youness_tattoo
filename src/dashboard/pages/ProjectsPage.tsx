import { zonedTimeToInstant } from '@younes/contracts';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@younes/contracts';
import { cx } from '../../lib/cx';
import { api, errorText } from '../api';
import { DashIcon } from '../DashIcon';
import { ago, fullDate } from '../format';
import { PageHeader } from '../components/PageHeader';
import { button, field } from '../ui';
import { useResource } from '../useResource';
import { AccountLine, PortalThread, type PortalMessage } from '../portal/PortalThread';

const ROOT = '/studio/projects';

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  placement: string | null;
  size: string | null;
  clientId: string;
  clientName: string;
  updatedAt: string;
  demo: boolean;
  unreadMessages: number;
  unansweredPhotos: number;
}
interface Inbox {
  messages: { id: string; at: string; clientName: string; projectId: string | null; inquiryId: string | null; about: string | null }[];
  photos: { id: string; at: string; clientName: string; projectId: string; projectTitle: string }[];
}
interface Project {
  id: string;
  title: string;
  concept: string | null;
  description: string | null;
  placement: string | null;
  size: string | null;
  status: string;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string | null; account: { email: string; verified: boolean; createdAt: string } | null };
  request: { id: string; ref: string } | null;
  media: { id: string; url: string; kind: 'reference' | 'design'; addedBy: 'client' | 'studio'; caption: string | null; at: string }[];
  messages: PortalMessage[];
  appointments: { id: string; kind: string; title: string; startsAt: string; endsAt: string; status: string; prep: string | null }[];
  aftercare: { id: string; guideId: string | null; title: string; startedOn: string; reminders: boolean; steps: { dayFrom: number; dayTo: number | null; title: string }[]; assignedAt: string } | null;
  photos: { id: string; url: string; note: string | null; at: string; response: string | null; respondedAt: string | null }[];
}
interface Guide {
  id: string;
  title: string;
  approved: boolean;
}

/**
 * Projects - what a client's accepted idea becomes, as they follow it in
 * their account. The list leads with what's waiting from clients (their
 * messages, their healing photos); a project holds its details and stage,
 * the images (theirs and your designs), the conversation, its sessions, and
 * its aftercare. Everything a client sees is marked as such.
 */
export function ProjectsPage() {
  const { projectId } = useParams();
  return projectId ? <ProjectView id={projectId} /> : <ProjectList />;
}

function ProjectList() {
  const now = new Date();
  const list = useResource<ProjectRow[]>('/api/studio/projects');
  const inbox = useResource<Inbox>('/api/studio/portal/inbox');
  const waiting = (inbox.data?.messages.length ?? 0) + (inbox.data?.photos.length ?? 0);
  return (
    <div className="grid gap-6">
      <PageHeader title="Projects" summary="Accepted ideas as your clients follow them in their accounts - and what they’ve sent you." demo={false} />
      {inbox.data && waiting > 0 && (
        <section aria-labelledby="fromClients" className="studio-card p-5" data-tone="attention">
          <h2 id="fromClients" className="type-heading text-[1.05rem]">
            From clients · {waiting}
          </h2>
          <ul className="mt-3 grid gap-2">
            {inbox.data.photos.map((p) => (
              <li key={p.id}>
                <Link to={`${ROOT}/${p.projectId}#photos`} className="flex flex-wrap items-center justify-between gap-2 rounded-(--studio-r-md) border border-rule p-3 hover:bg-(--studio-hover)">
                  <span className="text-[0.9375rem] font-semibold text-ink">
                    {p.clientName} sent a healing photo · {p.projectTitle}
                  </span>
                  <span className="text-[0.75rem] text-ink-muted">{ago(now, p.at)}</span>
                </Link>
              </li>
            ))}
            {inbox.data.messages.map((m) => (
              <li key={m.id}>
                <Link
                  to={m.projectId ? `${ROOT}/${m.projectId}` : `/studio/inquiries/all/${m.inquiryId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-(--studio-r-md) border border-rule p-3 hover:bg-(--studio-hover)"
                >
                  <span className="text-[0.9375rem] font-semibold text-ink">
                    {m.clientName} wrote{m.about ? ` · ${m.about}` : ''}
                  </span>
                  <span className="text-[0.75rem] text-ink-muted">{ago(now, m.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="All projects" className="studio-card p-0">
        {!list.data ? (
          <p role="status" className="p-5 text-ink-muted">
            {list.error ?? 'Loading projects…'}
          </p>
        ) : list.data.length === 0 ? (
          <p className="p-5 text-[0.9375rem] text-ink-soft">No projects yet. Start one from an accepted inquiry, or from a client’s record.</p>
        ) : (
          <ul>
            {list.data.map((p) => (
              <li key={p.id} className="border-b border-rule last:border-b-0">
                <Link to={`${ROOT}/${p.id}`} className="grid gap-1 px-5 py-4 hover:bg-(--studio-hover) @min-[48rem]:grid-cols-[minmax(0,1fr)_12rem_10rem] @min-[48rem]:items-center">
                  <span className="min-w-0">
                    <span className="block truncate text-[1rem] font-semibold text-ink">{p.title}</span>
                    <span className="text-[0.8125rem] text-ink-muted">
                      {p.clientName}
                      {p.demo && ' · sample'}
                    </span>
                  </span>
                  <span className="text-[0.875rem] text-ink-soft">{PROJECT_STATUS_LABEL[p.status as keyof typeof PROJECT_STATUS_LABEL] ?? p.status}</span>
                  <span className="flex flex-wrap gap-2 text-[0.75rem] font-semibold">
                    {p.unreadMessages > 0 && (
                      <span data-tone="attention" className="rounded-full bg-(--st-bg) px-2 py-0.5 text-(--st-fg)">
                        {p.unreadMessages} message{p.unreadMessages > 1 ? 's' : ''}
                      </span>
                    )}
                    {p.unansweredPhotos > 0 && (
                      <span data-tone="attention" className="rounded-full bg-(--st-bg) px-2 py-0.5 text-(--st-fg)">
                        {p.unansweredPhotos} photo{p.unansweredPhotos > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  const h = useId();
  return (
    <section id={id} aria-labelledby={h} className="studio-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={h} className="type-heading text-[1.05rem]">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
      {text}
    </p>
  ) : null;
}

const SEEN = <span className="text-[0.75rem] font-medium text-ink-muted">The client sees this</span>;

function ProjectView({ id }: { id: string }) {
  const now = new Date();
  const p = useResource<Project>(`/api/studio/projects/${id}`);
  const reload = () => void p.reload();
  if (!p.data) {
    return (
      <p role="status" className="studio-card p-5 text-ink-muted">
        {p.error ?? 'Loading the project…'}
      </p>
    );
  }
  const d = p.data;
  return (
    <div className="grid gap-5">
      <PageHeader
        title={d.title}
        trail={[{ label: 'Projects', to: ROOT }, { label: d.title }]}
        summary={
          <>
            For{' '}
            <Link to={`/studio/clients/${d.client.id}`} className="font-semibold text-burgundy underline underline-offset-2">
              {d.client.name}
            </Link>
            {d.request && <> · from inquiry {d.request.ref}</>} · <AccountLine account={d.client.account} />
          </>
        }
        demo={d.demo}
      />
      <div className="grid items-start gap-5 @min-[72rem]:grid-cols-2">
        <div className="grid gap-5">
          <Details project={d} onSaved={reload} />
          <Card title="Conversation" aside={SEEN}>
            {d.client.account?.verified ? (
              <PortalThread messages={d.messages} postTo={`/api/studio/projects/${d.id}/messages`} onSent={reload} clientName={d.client.name} now={now} />
            ) : (
              <p className="text-[0.9375rem] text-ink-soft">They don’t have a verified client account yet, so messages here can’t reach them.</p>
            )}
          </Card>
          <Images project={d} onAdded={reload} />
        </div>
        <div className="grid gap-5">
          <Sessions project={d} onAdded={reload} />
          <Aftercare project={d} onSaved={reload} />
          <Photos project={d} onAnswered={reload} now={now} />
        </div>
      </div>
    </div>
  );
}

function Details({ project: d, onSaved }: { project: Project; onSaved: () => void }) {
  const fid = useId();
  const [v, setV] = useState({ title: d.title, concept: d.concept ?? '', description: d.description ?? '', placement: d.placement ?? '', size: d.size ?? '', status: d.status });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    setSaved(false);
    setV((x) => ({ ...x, [k]: e.target.value }));
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/studio/projects/${d.id}`, { method: 'PATCH', body: { ...v, concept: v.concept || null, description: v.description || null, placement: v.placement || null, size: v.size || null } });
      setSaved(true);
      onSaved();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const input = (k: keyof typeof v, label: string, multi = false) => (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink" htmlFor={`${fid}-${k}`}>
      {label}
      {multi ? (
        <textarea id={`${fid}-${k}`} rows={3} value={v[k]} onChange={set(k)} className={cx(field, 'py-2 font-normal')} />
      ) : (
        <input id={`${fid}-${k}`} value={v[k]} onChange={set(k)} className={cx(field, 'h-9 font-normal')} />
      )}
    </label>
  );
  return (
    <Card title="The project" aside={SEEN}>
      <form onSubmit={save} className="grid gap-3">
        {input('title', 'Title')}
        <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink" htmlFor={`${fid}-status`}>
          Stage
          <select id={`${fid}-status`} value={v.status} onChange={set('status')} className={cx(field, 'h-9 font-normal')}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {input('concept', 'Concept')}
        {input('description', 'Description', true)}
        <div className="grid gap-3 @min-[30rem]:grid-cols-2">
          {input('placement', 'Placement')}
          {input('size', 'Approximate size')}
        </div>
        <Problem text={problem} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={button('primary', 'sm')}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span role="status" className="text-[0.8125rem] text-ink-muted">
              Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

function Upload({ postTo, label, onDone }: { postTo: string; label: string; onDone: () => void }) {
  const fid = useId();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="mt-4 grid gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        setProblem(null);
        const form = new FormData();
        form.append('caption', caption);
        form.append('file', file);
        try {
          await api(postTo, { form });
          setFile(null);
          setCaption('');
          (e.target as HTMLFormElement).reset();
          onDone();
        } catch (err) {
          setProblem(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={fid} className="text-[0.8125rem] font-semibold text-ink">
        {label}
      </label>
      <input id={fid} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[0.8125rem]" />
      <input aria-label="Caption" placeholder="Caption (optional)" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} className={cx(field, 'h-9')} />
      <Problem text={problem} />
      <div>
        <button type="submit" disabled={busy || !file} className={button('secondary', 'sm')}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  );
}

function Images({ project: d, onAdded }: { project: Project; onAdded: () => void }) {
  return (
    <Card title={`Images · ${d.media.length}`} aside={SEEN}>
      {d.media.length === 0 ? (
        <p className="text-[0.9375rem] text-ink-soft">No images yet - the client can add references from their account.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {d.media.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-(--studio-r-sm) border border-rule">
                <img src={`${m.url}?w=640`} alt={m.caption ?? (m.kind === 'design' ? 'Your design' : 'Their reference')} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
              <p className="mt-1 text-[0.75rem] text-ink-muted">
                <span className={m.kind === 'design' ? 'font-semibold text-burgundy' : 'font-semibold text-ink'}>{m.kind === 'design' ? 'Your design' : 'Their reference'}</span>
                {m.caption && ` · ${m.caption}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Upload postTo={`/api/studio/projects/${d.id}/designs`} label="Add a design for them" onDone={onAdded} />
    </Card>
  );
}

/** a session for this project - proposed (the client sees it as a proposal) or confirmed */
function Sessions({ project: d, onAdded }: { project: Project; onAdded: () => void }) {
  const fid = useId();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('11:00');
  const [end, setEnd] = useState('15:00');
  const [prep, setPrep] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function propose(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      // Detroit's wall-clock times, as instants - never this computer's time zone
      const startsAt = zonedTimeToInstant(date, start).toISOString();
      const endsAt = zonedTimeToInstant(date, end).toISOString();
      await api('/api/studio/appointments', { body: { clientId: d.client.id, projectId: d.id, kind: 'session', title: d.title, startsAt, endsAt, status: 'proposed', prep: prep || undefined } });
      setDate('');
      setPrep('');
      onAdded();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Sessions" aside={SEEN}>
      {d.appointments.length === 0 ? (
        <p className="text-[0.9375rem] text-ink-soft">No session yet.</p>
      ) : (
        <ul className="grid gap-2">
          {d.appointments.map((a) => (
            <li key={a.id} className="rounded-(--studio-r-md) border border-rule p-3">
              <p className="text-[0.9375rem] font-semibold text-ink">{fullDate(a.startsAt)} <span className="font-normal text-ink-muted">Detroit time</span></p>
              <p className="text-[0.8125rem] text-ink-muted">
                {a.status === 'proposed' ? 'Proposed - confirm it in the calendar once they agree' : a.status}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={propose} className="mt-4 grid gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3">
        <p className="text-[0.8125rem] font-semibold text-ink">
          Propose a session <span className="font-normal text-ink-muted">- times in Detroit time</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-d`}>
            Day
            <input id={`${fid}-d`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cx(field, 'h-9')} />
          </label>
          <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-s`}>
            From
            <input id={`${fid}-s`} type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={cx(field, 'h-9')} />
          </label>
          <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-e`}>
            Until
            <input id={`${fid}-e`} type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className={cx(field, 'h-9')} />
          </label>
        </div>
        <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-p`}>
          How to prepare (they see this; up to 300 characters)
          <textarea id={`${fid}-p`} rows={2} maxLength={300} value={prep} onChange={(e) => setPrep(e.target.value)} className={cx(field, 'py-2')} />
        </label>
        <Problem text={problem} />
        <div>
          <button type="submit" disabled={busy || !date} className={button('secondary', 'sm')}>
            <DashIcon name="calendar" className="size-3.5" />
            {busy ? 'Proposing…' : 'Propose this time'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Aftercare({ project: d, onSaved }: { project: Project; onSaved: () => void }) {
  const fid = useId();
  const guides = useResource<Guide[]>('/api/studio/aftercare/guides');
  const approved = (guides.data ?? []).filter((g) => g.approved);
  const [guideId, setGuideId] = useState('');
  const [startedOn, setStartedOn] = useState(new Date().toISOString().slice(0, 10));
  const [reminders, setReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function give(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/studio/projects/${d.id}/aftercare`, { method: 'PUT', body: { guideId, startedOn, reminders } });
      onSaved();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Aftercare" aside={SEEN}>
      {d.aftercare ? (
        <div className="grid gap-1">
          <p className="text-[0.9375rem] font-semibold text-ink">{d.aftercare.title}</p>
          <p className="text-[0.8125rem] text-ink-muted">
            From {d.aftercare.startedOn} · {d.aftercare.steps.length} stage{d.aftercare.steps.length === 1 ? '' : 's'} · reminders {d.aftercare.reminders ? 'on' : 'off'}
          </p>
          <p className="text-[0.75rem] text-ink-muted">Giving a guide again replaces their copy (and its reminders still to come).</p>
        </div>
      ) : (
        <p className="text-[0.9375rem] text-ink-soft">Not given yet.</p>
      )}
      {guides.data && approved.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-ink-soft">
          No approved guide yet -{' '}
          <Link to="/studio/aftercare" className="font-semibold text-burgundy underline underline-offset-2">
            write and approve one
          </Link>{' '}
          first.
        </p>
      ) : (
        <form onSubmit={give} className="mt-4 grid gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3">
          <div className="grid gap-2 @min-[30rem]:grid-cols-2">
            <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-g`}>
              Approved guide
              <select id={`${fid}-g`} required value={guideId} onChange={(e) => setGuideId(e.target.value)} className={cx(field, 'h-9')}>
                <option value="">Choose…</option>
                {approved.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted" htmlFor={`${fid}-day`}>
              Session day (day 0)
              <input id={`${fid}-day`} type="date" required value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className={cx(field, 'h-9')} />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-[0.8125rem] text-ink">
            <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            Email them as they reach each stage
          </label>
          <Problem text={problem} />
          <div>
            <button type="submit" disabled={busy || !guideId} className={button('secondary', 'sm')}>
              {busy ? 'Giving…' : d.aftercare ? 'Give this guide instead' : 'Give this aftercare'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Photos({ project: d, onAnswered, now }: { project: Project; onAnswered: () => void; now: Date }) {
  return (
    <Card id="photos" title={`Healing photos · ${d.photos.length}`} aside={SEEN}>
      {d.photos.length === 0 ? (
        <p className="text-[0.9375rem] text-ink-soft">None yet. Once aftercare is given, the client can send photos as it heals.</p>
      ) : (
        <ul className="grid gap-4">
          {d.photos.map((ph) => (
            <li key={ph.id} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
              <a href={ph.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-(--studio-r-sm) border border-rule">
                <img src={`${ph.url}?w=640`} alt={`Healing photo from ${d.client.name}`} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
              <div className="min-w-0">
                <p className="text-[0.75rem] text-ink-muted" title={fullDate(ph.at)}>
                  Sent {ago(now, ph.at)}
                </p>
                {ph.note && <p className="mt-1 text-[0.9375rem] text-ink">“{ph.note}”</p>}
                {ph.response ? (
                  <p className="mt-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-2 text-[0.875rem] whitespace-pre-line text-ink-soft">
                    <span className="font-semibold text-ink">You answered:</span> {ph.response}
                  </p>
                ) : (
                  <Answer photoId={ph.id} onDone={onAnswered} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Answer({ photoId, onDone }: { photoId: string; onDone: () => void }) {
  const fid = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        try {
          await api(`/api/studio/healing-photos/${photoId}`, { method: 'PATCH', body: { response: text } });
          onDone();
        } catch (err) {
          setProblem(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={fid} className="text-[0.75rem] font-semibold text-ink-muted">
        Your answer (they see it)
      </label>
      <textarea id={fid} rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={cx(field, 'py-2')} />
      <Problem text={problem} />
      <div>
        <button type="submit" disabled={busy || !text.trim()} className={button('primary', 'sm')}>
          {busy ? 'Sending…' : 'Answer'}
        </button>
      </div>
    </form>
  );
}
