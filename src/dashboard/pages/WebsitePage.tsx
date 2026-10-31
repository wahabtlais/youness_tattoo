import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE_CONTENT, type OptionalSection, type SiteContent } from '../../data/siteContent';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { ContentState } from '@younes/contracts';
import { PREVIEW_PARAM } from '../../hooks/useSiteContent';
import { api, ApiError, errorText } from '../api';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { PageHeader } from '../components/PageHeader';
import { STUDIO_ROOT } from '../navigation';
import { button, field } from '../ui';

type Editable = 'artist' | 'experiences' | 'process' | 'journal' | 'canvasCalls' | 'book';
type SectionId = 'hero' | 'work' | Editable | 'frame';

interface Field {
  /** where it lives in SiteContent, e.g. "process.steps.1.title" */
  path: string;
  label: string;
  kind: 'text' | 'area' | 'paragraphs';
  max: number;
  /** may be left empty (only the artist's introduction) */
  optional?: true;
  help?: string;
}

interface Section {
  id: SectionId;
  name: string;
  about: string;
  icon: DashIconName;
  /** can be hidden: its key in SiteContent.visible */
  toggle?: OptionalSection;
  /** can't be hidden, and why */
  locked?: string;
  /** its own content lives in another module */
  elsewhere?: { text: string; to?: string; label?: string };
  /** also hidden by the site itself when it has nothing to show */
  auto?: string;
  fields?: Field[];
}

/** the home page, top to bottom - only what really is on it (pages/HomePage.tsx) */
const SECTIONS: Section[] = [
  { id: 'hero', name: 'Hero', icon: 'overview', about: 'The opening of the home page, with the main way to ask for a consultation.', locked: 'It’s the approved opening and the primary way to start a consultation.' },
  {
    id: 'work',
    name: 'Work archive & Find Similar',
    icon: 'portfolio',
    about: 'The archive of Younes’s work, and Find Similar from any piece.',
    locked: 'The work is the heart of the site, and Find Similar starts consultations from it.',
    elsewhere: { text: 'The pieces themselves are managed in Portfolio.', to: `${STUDIO_ROOT}/portfolio`, label: 'Open Portfolio' },
  },
  {
    id: 'artist',
    name: 'The artist',
    icon: 'account',
    about: 'Younes’s portrait, a headline and his introduction.',
    toggle: 'artist',
    elsewhere: { text: 'The portrait is a photograph in the site’s files - not editable here.' },
    fields: [
      { path: 'artist.label', label: 'Small label above the headline', kind: 'text', max: 40 },
      { path: 'artist.headline', label: 'Headline', kind: 'text', max: 90 },
      { path: 'artist.intro', label: 'Introduction, in his own words', kind: 'paragraphs', max: 1200, optional: true, help: 'Leave a blank line between paragraphs. Optional: until it’s written, the section shows no introduction.' },
      { path: 'artist.meta.0', label: 'Fact 1', kind: 'text', max: 40 },
      { path: 'artist.meta.1', label: 'Fact 2 (also the portrait’s caption)', kind: 'text', max: 40 },
      { path: 'artist.meta.2', label: 'Fact 3', kind: 'text', max: 40 },
    ],
  },
  {
    id: 'experiences',
    name: 'Client experiences',
    icon: 'clients',
    about: 'Clients’ words about working with Younes.',
    toggle: 'experiences',
    elsewhere: { text: 'The testimonials themselves are kept with each client’s consent in the site’s files - there’s no dashboard editor for them yet. Today they are fictional demo entries, labelled on the site.' },
    fields: [
      { path: 'experiences.eyebrow', label: 'Small label', kind: 'text', max: 40 },
      { path: 'experiences.heading', label: 'Heading', kind: 'text', max: 80 },
      { path: 'experiences.intro', label: 'Introduction', kind: 'area', max: 220 },
    ],
  },
  {
    id: 'process',
    name: 'The process',
    icon: 'prepare',
    about: 'How starting a tattoo with Younes usually goes, in four steps.',
    toggle: 'process',
    fields: [
      { path: 'process.eyebrow', label: 'Small label', kind: 'text', max: 40 },
      { path: 'process.heading', label: 'Heading', kind: 'text', max: 80 },
      { path: 'process.intro', label: 'Introduction', kind: 'area', max: 260 },
      ...[0, 1, 2, 3].flatMap((i): Field[] => [
        { path: `process.steps.${i}.title`, label: `Step ${i + 1} · title`, kind: 'text', max: 40 },
        { path: `process.steps.${i}.body`, label: `Step ${i + 1} · description`, kind: 'area', max: 260 },
      ]),
      { path: 'process.closing', label: 'Closing line, beside “Start a consultation”', kind: 'text', max: 80 },
    ],
  },
  {
    id: 'journal',
    name: 'Journal preview',
    icon: 'publishing',
    about: 'The latest three journal posts, and the way to the Journal.',
    toggle: 'journal',
    auto: 'The site also hides it on its own while the Journal is empty.',
    elsewhere: { text: 'Posts are managed in Journal & Canvas Calls.', to: `${STUDIO_ROOT}/publishing/journal`, label: 'Open the Journal' },
    fields: [
      { path: 'journal.eyebrow', label: 'Small label', kind: 'text', max: 40 },
      { path: 'journal.heading', label: 'Heading', kind: 'text', max: 80 },
      { path: 'journal.intro', label: 'Introduction', kind: 'area', max: 220 },
    ],
  },
  {
    id: 'canvasCalls',
    name: 'Canvas calls preview',
    icon: 'publishing',
    about: 'Up to three open canvas calls, and the way to all of them.',
    toggle: 'canvasCalls',
    auto: 'The site also hides it on its own while no call is open.',
    elsewhere: { text: 'Calls are managed in Journal & Canvas Calls.', to: `${STUDIO_ROOT}/publishing/calls`, label: 'Open Canvas Calls' },
    fields: [
      { path: 'canvasCalls.heading', label: 'Heading', kind: 'text', max: 80 },
      { path: 'canvasCalls.intro', label: 'Introduction', kind: 'area', max: 260 },
    ],
  },
  {
    id: 'book',
    name: 'Start a consultation',
    icon: 'reply',
    about: 'The closing invitation - “Ready to make it yours?” - and its button.',
    locked: 'It’s the main way in at the end of the page. Its headline is part of the design; only the line under it is editable.',
    fields: [{ path: 'book.intro', label: 'Line under the headline', kind: 'area', max: 160 }],
  },
  { id: 'frame', name: 'Navigation & footer', icon: 'menu', about: 'The menu at the top and the footer on every page.', locked: 'Every page needs them to get around and to reach the consultation.' },
];

// ---- reading and writing a field by its path ----
const get = (c: SiteContent, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], c);
function set(c: SiteContent, path: string, value: unknown): SiteContent {
  const next = structuredClone(c);
  const keys = path.split('.');
  let o = next as unknown as Record<string, unknown>;
  keys.slice(0, -1).forEach((k) => (o = o[k] as Record<string, unknown>));
  o[keys[keys.length - 1]] = value;
  return next;
}
/** a field's text as the form shows it */
const text = (c: SiteContent, f: Field) => (f.kind === 'paragraphs' ? ((get(c, f.path) as string[]) ?? []).join('\n\n') : String(get(c, f.path) ?? ''));
const toValue = (f: Field, s: string) => (f.kind === 'paragraphs' ? s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : s);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const problem = (f: Field, s: string) => (!f.optional && !s.trim() ? 'Required — the site needs words here.' : s.length > f.max ? `Too long — ${s.length} of ${f.max} characters.` : null);

/** every field and visibility that differs from what's published */
function changesIn(c: SiteContent, live: SiteContent) {
  const out: string[] = [];
  for (const s of SECTIONS) {
    if (s.toggle && c.visible[s.toggle] !== live.visible[s.toggle]) out.push(`${s.name}: ${c.visible[s.toggle] ? 'shown' : 'hidden'}`);
    for (const f of s.fields ?? []) if (!same(get(c, f.path), get(live, f.path))) out.push(`${s.name}: ${f.label}`);
  }
  return out;
}

/** the published content, for every "what's live" comparison below */
const Live = createContext<SiteContent>(SITE_CONTENT);

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * /studio/website - Website Management: which of the home page's optional
 * sections show, and the words in them. Not a page builder: the design,
 * layout, images and order aren't editable, and records with their own
 * modules (pieces, posts, calls) are edited there - this links to them.
 *
 * Edits are saved to the studio's private draft (in the database); the
 * home page can show the draft as a preview to the signed-in owner only.
 * Publishing makes the draft the next published version - the content the
 * site is served with - and every version stays, so any of them can be
 * restored. Whether published content actually reaches visitors depends on
 * how the site is served, and the page says which (ContentState.delivery).
 */
export function WebsitePage() {
  useDocumentTitle('Website Management');
  const [content, setContent] = useState<ContentState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<SiteContent>(SITE_CONTENT);
  const [open, setOpen] = useState<SectionId>('artist');
  const [notice, setNotice] = useState<{ tone: string; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (resetForm: boolean) => {
    try {
      const s = await api<ContentState>('/api/studio/content/home');
      setContent(s);
      setLoadError(null);
      if (resetForm) setForm(s.draft as SiteContent);
      return s;
    } catch (e) {
      setLoadError(errorText(e));
      return null;
    }
  };
  useEffect(() => {
    api<ContentState>('/api/studio/content/home').then(
      (s) => {
        setContent(s);
        setForm(s.draft as SiteContent);
      },
      (e) => setLoadError(errorText(e)),
    );
  }, []);

  const draft = (content?.draft ?? SITE_CONTENT) as SiteContent;
  const live = (content?.published?.data ?? SITE_CONTENT) as SiteContent;
  const section = SECTIONS.find((s) => s.id === open)!;
  const unsaved = (id: SectionId) => {
    const s = SECTIONS.find((x) => x.id === id)!;
    return (s.fields ?? []).some((f) => !same(get(form, f.path), get(draft, f.path)));
  };
  const anyUnsaved = SECTIONS.some((s) => unsaved(s.id));
  const changes = changesIn(draft, live);

  // leaving with unsaved edits: the browser asks first
  useEffect(() => {
    if (!anyUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyUnsaved]);

  /** save a whole draft to the server; the form keeps any other section's unsaved edits */
  const saveDraft = async (next: SiteContent, message: string) => {
    setBusy('save');
    try {
      await api('/api/studio/content/home/draft', { method: 'PUT', body: { draft: next } });
      await load(false);
      setNotice({ tone: 'success', text: message });
      return true;
    } catch (e) {
      setNotice({ tone: 'danger', text: e instanceof ApiError && Object.keys(e.fields).length ? `${e.message} (${Object.values(e.fields)[0]})` : errorText(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };
  const toggle = async (k: OptionalSection) => {
    const next = { ...draft, visible: { ...draft.visible, [k]: !draft.visible[k] } };
    if (await saveDraft(next, 'Saved to the draft. Publish to show it to visitors.')) setForm((f) => ({ ...f, visible: next.visible }));
  };
  const save = async (s: Section) => {
    let next = draft;
    for (const f of s.fields ?? []) next = set(next, f.path, get(form, f.path));
    await saveDraft(next, `${s.name}: saved to the draft. Visitors still see the published version until you publish.`);
  };
  const cancel = (s: Section) => {
    setForm((f) => {
      let g = f;
      for (const fl of s.fields ?? []) g = set(g, fl.path, get(draft, fl.path));
      return g;
    });
    setNotice(null);
  };
  const run = async (what: string, call: () => Promise<unknown>, message: (s: ContentState | null) => string, resetForm = false) => {
    setBusy(what);
    setNotice(null);
    try {
      await call();
      const s = await load(resetForm);
      setNotice({ tone: 'success', text: message(s) });
    } catch (e) {
      setNotice({ tone: 'danger', text: errorText(e) });
    } finally {
      setBusy(null);
      setConfirmDiscard(false);
    }
  };
  const delivered = (s: ContentState | null) =>
    s?.delivery === 'served' ? 'Visitors see it on their next page load.' : 'It’s published in the studio’s records, but no public site is served by this server yet - visitors won’t see it until one is connected.';
  const publish = () => run('publish', () => api('/api/studio/content/home/publish', { method: 'POST' }), (s) => `Published as version ${s?.published?.version}. ${delivered(s)}`);
  const discard = () => run('discard', () => api('/api/studio/content/home/draft', { method: 'DELETE' }), () => 'The draft is discarded - it matches the published content again.', true);
  const restore = (version: number) =>
    run('restore', () => api('/api/studio/content/home/rollback', { body: { version } }), (s) => `Version ${version} is published again (as version ${s?.published?.version}). ${delivered(s)}`, true);

  if (!content)
    return (
      <div className="grid gap-5">
        <PageHeader title="Website Management" demo={false} />
        {loadError ? <p className="studio-card p-4 text-[0.9375rem] text-ink-soft">{loadError}</p> : <p className="text-ink-muted">Loading…</p>}
      </div>
    );

  return (
    <Live.Provider value={live}>
      <div className="grid gap-5">
        <PageHeader
          title="Website Management"
          demo={false}
          summary="Choose which home-page sections show, and edit their words. The design - layout, type, colours, images - stays as it is."
        />

        {/* where the content stands: published, the draft, and what can be done with it */}
        <section aria-label="Publishing" data-tone={changes.length ? 'attention' : 'success'} className="studio-card relative overflow-hidden p-4">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--st-solid)" />
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pl-1">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-bold text-(--st-fg)">
                  <DashIcon name={changes.length ? 'clock' : 'check'} className="size-3.5" />
                  {changes.length ? `${changes.length} unpublished ${changes.length === 1 ? 'change' : 'changes'}` : 'Draft matches the published version'}
                </span>
                {content.published ? `Published: version ${content.published.version}, ${when(content.published.publishedAt)}` : 'Nothing published yet'}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-snug text-ink-muted">
                {content.delivery === 'served'
                  ? 'This server serves the public site: what’s published is what visitors see.'
                  : 'No public site is served by this server yet: publishing updates the studio’s records, not a live site.'}{' '}
                The draft is private to the studio.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {changes.length > 0 && (
                <>
                  <a href={`/?${PREVIEW_PARAM}`} target="_blank" rel="noreferrer" className={button('secondary', 'md')}>
                    Preview on the site
                    <DashIcon name="external" />
                  </a>
                  {confirmDiscard ? (
                    <span data-tone="danger" className="inline-flex items-center gap-1">
                      <button type="button" onClick={discard} disabled={!!busy} className={button('danger', 'md', 'border-(--st-line)')}>
                        Discard {changes.length} {changes.length === 1 ? 'change' : 'changes'}
                      </button>
                      <button type="button" onClick={() => setConfirmDiscard(false)} className={button('ghost', 'md')}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <span data-tone="danger">
                      <button type="button" onClick={() => setConfirmDiscard(true)} className={button('danger', 'md')}>
                        Discard draft
                      </button>
                    </span>
                  )}
                  <button type="button" onClick={publish} disabled={!!busy || anyUnsaved} title={anyUnsaved ? 'Save or cancel your unsaved edits first' : undefined} className={button('primary', 'md')}>
                    <DashIcon name="globe" />
                    {busy === 'publish' ? 'Publishing…' : 'Publish'}
                  </button>
                </>
              )}
            </div>
          </div>
          {changes.length > 0 && (
            <details className="group mt-3 pl-1">
              <summary className="cursor-pointer text-[0.8125rem] font-semibold text-ink-soft hover:text-ink">What’s changed</summary>
              <ul className="mt-1.5 grid list-disc gap-0.5 pl-5 text-[0.8125rem] text-ink-soft">
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
          {anyUnsaved && changes.length > 0 && <p className="mt-2 pl-1 text-[0.8125rem] text-ink-muted">Save or cancel the section you’re editing before publishing.</p>}
          {notice && (
            <p role="status" data-tone={notice.tone} className="mt-3 ml-1 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-ink">
              {notice.text}
            </p>
          )}
        </section>

        <div className="grid items-start gap-5 @min-[60rem]:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
          <div className="grid gap-5">
            {/* the home page, top to bottom */}
            <section aria-labelledby="siteSections" className="studio-card overflow-hidden">
              <div className="border-b border-rule px-4 py-3">
                <h2 id="siteSections" className="type-heading text-[1.05rem]">
                  Home page sections
                </h2>
                <p className="text-[0.8125rem] text-ink-muted">In the order visitors see them</p>
              </div>
              <ol className="divide-y divide-rule">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <SectionRow s={s} current={open === s.id} draft={draft} unsaved={unsaved(s.id)} onOpen={() => setOpen(s.id)} onToggle={s.toggle ? () => void toggle(s.toggle!) : undefined} />
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="siteVersions" className="studio-card overflow-hidden">
              <div className="border-b border-rule px-4 py-3">
                <h2 id="siteVersions" className="type-heading text-[1.05rem]">
                  Published versions
                </h2>
                <p className="text-[0.8125rem] text-ink-muted">Every publish is kept. Restoring publishes an old version again.</p>
              </div>
              <ol aria-label="Versions" className="max-h-72 divide-y divide-rule overflow-y-auto">
                {content.versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-[0.875rem] font-semibold text-ink">
                        Version {v.version}
                        {v.current && <span className="ml-2 rounded-full bg-(--studio-selected) px-2 py-0.5 text-[0.6875rem] text-ink">Published now</span>}
                      </span>
                      <span className="block text-[0.75rem] text-ink-muted">
                        {when(v.publishedAt)}
                        {v.publishedBy ? ` · ${v.publishedBy}` : ' · imported'}
                      </span>
                    </span>
                    {!v.current && (
                      <button type="button" onClick={() => restore(v.version)} disabled={!!busy || anyUnsaved} className={button('secondary', 'sm')}>
                        Restore
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <Editor key={section.id} s={section} form={form} draft={draft} busy={busy === 'save'} onChange={(path, v) => setForm((f) => set(f, path, v))} onSave={() => void save(section)} onCancel={() => cancel(section)} unsaved={unsaved(section.id)} onToggle={section.toggle ? () => void toggle(section.toggle!) : undefined} />
        </div>
      </div>
    </Live.Provider>
  );
}

/** shown or hidden: what's live, and what the draft would change it to */
function Visibility({ k, draft }: { k: OptionalSection; draft: SiteContent }) {
  const live = useContext(Live).visible[k];
  const next = draft.visible[k];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span data-tone={live ? 'success' : 'neutral'} className="inline-flex h-6 items-center gap-1 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
        <span aria-hidden="true" className={cx('size-1.5 rounded-full', live ? 'bg-(--st-solid)' : 'border border-(--st-solid)')} />
        {live ? 'Shown' : 'Hidden'}
      </span>
      {live !== next && (
        <span data-tone="attention" className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-(--st-solid) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
          <DashIcon name="clock" className="size-3" />
          {next ? 'Will show' : 'Will hide'} · unpublished
        </span>
      )}
    </span>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      // fixed geometry: 44 x 24, an 18px knob travelling 20px
      style={{ width: 44, height: 24 }}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid motion-reduce:transition-none',
        on ? 'border-transparent bg-burgundy' : 'border-(--studio-line-strong) bg-(--studio-sunken)',
      )}
    >
      <span aria-hidden="true" style={{ width: 18, height: 18, transform: `translateX(${on ? 22 : 2}px)`, background: on ? 'var(--studio-on-accent)' : 'var(--studio-text-3)' }} className="block rounded-full shadow-sm transition-transform motion-reduce:transition-none" />
    </button>
  );
}

function SectionRow({ s, current, draft, unsaved, onOpen, onToggle }: { s: Section; current: boolean; draft: SiteContent; unsaved: boolean; onOpen: () => void; onToggle?: () => void }) {
  return (
    <div className={cx('relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--studio-hover)', current && 'bg-(--studio-selected) hover:bg-(--studio-selected)')}>
      {current && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-burgundy" />}
      <button type="button" onClick={onOpen} aria-current={current ? 'true' : undefined} className="grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)] gap-3 text-left after:absolute after:inset-0 focus-visible:outline-none [&:focus-visible]:after:outline-2 [&:focus-visible]:after:-outline-offset-2 [&:focus-visible]:after:outline-focus [&:focus-visible]:after:outline-solid">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-(--studio-r-sm) bg-(--studio-sunken) text-ink-soft">
          <DashIcon name={s.icon} className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-semibold text-ink">
            {s.name}
            {unsaved && (
              <span data-tone="attention" className="text-[0.75rem] font-semibold text-(--st-fg)">
                · unsaved edits
              </span>
            )}
          </span>
          <span className="mt-1 block">
            {s.toggle ? (
              <Visibility k={s.toggle} draft={draft} />
            ) : (
              <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-ink-muted">
                <DashIcon name="lock" className="size-3.5" />
                Always shown
              </span>
            )}
          </span>
        </span>
      </button>
      {/* above the row's own button, so it toggles without opening */}
      {s.toggle && onToggle && (
        <span className="relative z-[1]">
          <Switch on={draft.visible[s.toggle]} label={`Show ${s.name} on the home page`} onChange={onToggle} />
        </span>
      )}
    </div>
  );
}

function Editor({
  s,
  form,
  draft,
  unsaved,
  onChange,
  onSave,
  onCancel,
  onToggle,
  busy,
}: {
  s: Section;
  form: SiteContent;
  draft: SiteContent;
  unsaved: boolean;
  onChange: (path: string, v: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle?: () => void;
  busy?: boolean;
}) {
  const live = useContext(Live);
  const fields = s.fields ?? [];
  const errors = fields.map((f) => problem(f, text(form, f)));
  const invalid = errors.some(Boolean);
  return (
    <section aria-labelledby="editorTitle" className="studio-card min-w-0 overflow-hidden">
      <div className="border-b border-rule p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="editorTitle" className="type-heading text-[1.2rem]">
              {s.name}
            </h2>
            <p className="mt-0.5 text-[0.9375rem] text-ink-soft">{s.about}</p>
          </div>
          {s.toggle && onToggle && (
            <label className="inline-flex items-center gap-2.5 text-[0.875rem] font-semibold text-ink">
              Show on the home page
              <Switch on={draft.visible[s.toggle]} label={`Show ${s.name} on the home page`} onChange={onToggle} />
            </label>
          )}
        </div>
        <div className="mt-3 grid gap-2">
          {s.toggle && <Visibility k={s.toggle} draft={draft} />}
          {s.locked && (
            <Note icon="lock" tone="neutral">
              <span className="font-semibold">Can’t be hidden.</span> {s.locked}
            </Note>
          )}
          {s.auto && <Note icon="clock" tone="info">{s.auto}</Note>}
          {s.elsewhere && (
            <Note icon="external" tone="neutral">
              {s.elsewhere.text}{' '}
              {s.elsewhere.to && (
                <Link to={s.elsewhere.to} className="font-semibold text-burgundy hover:underline">
                  {s.elsewhere.label}
                </Link>
              )}
            </Note>
          )}
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="p-5 text-[0.9375rem] text-ink-soft">No words here are editable - this part of the site is fixed by its design.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid && unsaved) onSave();
          }}
          noValidate
        >
          <div className="grid gap-5 p-5">
            {fields.map((f, i) => (
              <FieldEditor key={f.path} f={f} value={text(form, f)} published={text(live, f)} error={errors[i]} onChange={(v) => onChange(f.path, toValue(f, v))} />
            ))}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-(--studio-panel) px-5 py-3">
            <p className="text-[0.8125rem] text-ink-muted" aria-live="polite">
              {invalid ? 'Fix the marked fields to save.' : unsaved ? 'Unsaved edits on this section.' : 'Nothing to save.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} disabled={!unsaved} className={button('ghost')}>
                Cancel
              </button>
              <button type="submit" disabled={!unsaved || invalid || busy} className={button('primary')}>
                {busy ? 'Saving…' : 'Save to draft'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function Note({ icon, tone, children }: { icon: DashIconName; tone: string; children: ReactNode }) {
  return (
    <p data-tone={tone} className="flex items-start gap-2 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] leading-snug text-ink">
      <DashIcon name={icon} className="mt-0.5 size-4 shrink-0 text-(--st-fg)" />
      <span>{children}</span>
    </p>
  );
}

function FieldEditor({ f, value, published, error, onChange }: { f: Field; value: string; published: string; error: string | null; onChange: (v: string) => void }) {
  const id = useId();
  const changed = value !== published;
  const long = f.kind !== 'text';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.875rem] font-semibold text-ink">
          {f.label}
          {f.optional && <span className="font-normal text-ink-muted"> · optional</span>}
        </label>
        <span className={cx('text-[0.75rem] tabular-nums', value.length > f.max ? 'font-semibold text-(--st-fg)' : 'text-ink-muted')} data-tone="danger">
          {value.length}/{f.max}
        </span>
      </div>
      {f.help && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{f.help}</p>}
      {long ? (
        <textarea
          id={id}
          value={value}
          rows={f.kind === 'paragraphs' ? 6 : 3}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cx(field, 'mt-1.5 block w-full resize-y py-2 leading-relaxed', error && 'border-(--st-solid)')}
          data-tone={error ? 'danger' : undefined}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cx(field, 'mt-1.5 block h-10 w-full', error && 'border-(--st-solid)')}
          data-tone={error ? 'danger' : undefined}
        />
      )}
      {error && (
        <p id={`${id}-err`} data-tone="danger" className="mt-1 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-(--st-fg)">
          <DashIcon name="alert" className="size-3.5" />
          {error}
        </p>
      )}
      {changed && !error && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] text-ink-muted">
          <span data-tone="attention" className="font-semibold text-(--st-fg)">
            Changed
          </span>
          <span className="min-w-0">Live: “{published || 'empty'}”</span>
          <button type="button" onClick={() => onChange(published)} className="font-semibold text-burgundy hover:underline">
            Restore
          </button>
        </div>
      )}
    </div>
  );
}
