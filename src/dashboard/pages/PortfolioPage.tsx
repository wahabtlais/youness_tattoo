import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import { StateMessage } from '../../components/ui/StateMessage';
import { traitLabel } from '../../domain/work';
import { useCanvasCalls, useJournal } from '../../hooks/useContent';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import { EmptyState } from '../components/EmptyState';
import { PieceEditor, UploadPanel, type StudioWork } from '../portfolio/studioWorks';
import { useStudioWorks } from '../portfolio/useStudioWorks';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { ago, plural } from '../format';
import { StatusBadge } from '../inquiries/StatusBadge';
import { STUDIO_ROOT } from '../navigation';
import { inquiriesFromPiece, inquiryPath } from '../records';
import { button } from '../ui';
import { useOverview } from '../useOverview';

const ROOT = `${STUDIO_ROOT}/portfolio`;
type Filter = 'all' | 'asked' | 'featured' | 'unverified';

/**
 * /studio/portfolio - Younes's work as it stands on the public site, and
 * /studio/portfolio/:id - one piece. Photographs first: a grid of the real
 * archive, each with its number and how it's being used (inquiries that
 * started from it in Find Similar, journal posts and canvas calls that
 * show it). A piece's view says plainly what isn't known yet: no title,
 * style, placement or description has been confirmed, and the sample
 * values Find Similar is built on are fictional - shown only folded away,
 * labelled as such, never as facts. Pieces are uploaded here (they start
 * private), their details edited and confirmed, and published or taken off.
 */
export function PortfolioPage() {
  const [now] = useState(() => new Date());
  const studio = useStudioWorks();
  const work = studio.list ? { status: 'success' as const, data: studio.list } : { status: studio.error ? ('error' as const) : ('loading' as const) };
  const overview = useOverview(now);
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const journal = useJournal();
  const calls = useCanvasCalls();
  const { pieceId } = useParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');

  const posts = journal.status === 'success' ? journal.data.items : [];
  const callItems = calls.status === 'success' ? calls.data.items : [];
  const usage: Record<string, Usage> = (() => {
    if (work.status !== 'success' || overview.status !== 'success') return {};
    return Object.fromEntries(
      work.data.map((w) => [
        w.id,
        {
          inquiries: inquiriesFromPiece(overview.data, w.id),
          posts: posts.filter((p) => p.workIds?.includes(w.id) || (p.image && 'workId' in p.image && p.image.workId === w.id)),
          calls: callItems.filter((c) => c.workIds?.includes(w.id) || (c.artwork.kind === 'reference' && c.artwork.workId === w.id)),
        },
      ]),
    );
  })();

  const piece = work.status === 'success' ? work.data.find((w) => w.id === pieceId) : undefined;
  useDocumentTitle(piece ? `Piece ${piece.id} · Portfolio` : 'Portfolio');
  if (work.status !== 'success' || overview.status !== 'success') return <StateMessage kind={work.status === 'error' || overview.status === 'error' ? 'error' : 'loading'} title="The portfolio couldn’t be loaded." />;

  const all = work.data;
  const u = (w: StudioWork) => usage[w.id];
  const matches = (w: StudioWork) =>
    filter === 'all' ||
    (filter === 'asked' && u(w).inquiries.length > 0) ||
    (filter === 'featured' && u(w).posts.length + u(w).calls.length > 0) ||
    (filter === 'unverified' && w.metadataStatus !== 'verified');
  const q = text.trim().replace(/^0*/, '');
  const shown = all.filter((w) => matches(w) && (!q || w.id.replace(/^0*/, '').startsWith(q)));
  const count = (f: Filter) => all.filter((w) => (f === 'all' ? true : f === 'asked' ? u(w).inquiries.length > 0 : f === 'featured' ? u(w).posts.length + u(w).calls.length > 0 : w.metadataStatus !== 'verified')).length;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Portfolio"
        trail={piece ? [{ label: 'Portfolio', to: ROOT }, { label: `Piece ${piece.id}` }] : undefined}
        summary={`${plural(all.filter((w) => w.published).length, 'piece')} on the public site${all.some((w) => !w.published) ? ` · ${all.filter((w) => !w.published).length} private` : ''} · ${count('unverified')} still need confirmed details`}
        demo={false}
        actions={
          <button type="button" onClick={() => setUploading(true)} className={button('primary')}>
            <DashIcon name="portfolio" />
            Add a piece
          </button>
        }
      />

      <div className="grid items-start gap-5 @min-[64rem]:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <section aria-label="All pieces" className={cx('grid min-w-0 gap-4', piece && '@max-[64rem]:hidden')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: count('all') },
                { value: 'asked', label: 'Asked about', count: count('asked') },
                { value: 'featured', label: 'In journal or calls', count: count('featured') },
                { value: 'unverified', label: 'Needs details', count: count('unverified') },
              ]}
            />
            <label className="flex h-10 items-center gap-2 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-field) px-3 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:border-ink-muted has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid">
              Piece no.
              <input
                value={text}
                onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="04"
                aria-label="Find a piece by number"
                className="w-10 bg-transparent text-[0.9375rem] font-semibold text-ink outline-none placeholder:text-ink-muted"
              />
            </label>
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon="portfolio"
              title="No pieces match."
              action={
                <button type="button" className={button('secondary', 'sm')} onClick={() => (setFilter('all'), setText(''))}>
                  Show every piece
                </button>
              }
            >
              {filter === 'featured' ? 'No piece is shown in a journal post or canvas call yet.' : 'Try another number or filter.'}
            </EmptyState>
          ) : (
            <ul aria-label="Pieces" className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-3 @min-[80rem]:grid-cols-4">
              {shown.map((w) => {
                const use = u(w);
                const current = w.id === piece?.id;
                return (
                  <li key={w.id}>
                    <Link
                      to={`${ROOT}/${w.id}`}
                      aria-current={current ? 'page' : undefined}
                      aria-label={`Piece ${w.id}${use.inquiries.length ? `, ${plural(use.inquiries.length, 'inquiry', 'inquiries')} started from it` : ''}`}
                      className={cx(
                        'group block overflow-hidden rounded-(--studio-r-md) border bg-(--studio-panel) shadow-(--studio-shadow) transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-(--studio-shadow-lift) motion-reduce:hover:translate-y-0',
                        current ? 'border-burgundy ring-2 ring-burgundy/40' : 'border-rule hover:border-(--studio-line-strong)',
                      )}
                    >
                      <ResponsiveImage image={w.image} alt="" ratio="4 / 5" sizes="(min-width: 1440px) 18vw, (min-width: 820px) 28vw, 46vw" className="transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:group-hover:scale-100" />
                      <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] font-bold text-ink tabular-nums">{w.id}</span>
                          <span className="block truncate text-[0.75rem] text-ink-muted">
                            {w.published ? w.title : `Private · ${w.title}`}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {use.inquiries.length > 0 && (
                            <span data-tone="accent" title={`${plural(use.inquiries.length, 'inquiry', 'inquiries')} started from it`} className="inline-flex h-6 items-center gap-1 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
                              <DashIcon name="inquiries" className="size-3.5" />
                              {use.inquiries.length}
                            </span>
                          )}
                          {use.posts.length + use.calls.length > 0 && (
                            <span data-tone="info" title="Shown in the journal or a canvas call" className="inline-flex h-6 items-center gap-1 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
                              <DashIcon name="publishing" className="size-3.5" />
                              {use.posts.length + use.calls.length}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-ink-muted">
            <span data-tone="accent" className="inline-flex items-center gap-1 font-semibold text-(--st-fg)">
              <DashIcon name="inquiries" className="size-3.5" /> inquiries
            </span>
            started from the piece in Find Similar ·
            <span data-tone="info" className="inline-flex items-center gap-1 font-semibold text-(--st-fg)">
              <DashIcon name="publishing" className="size-3.5" /> posts and calls
            </span>
            that show it
          </p>
        </section>

        {uploading ? (
          <UploadPanel
            onCancel={() => setUploading(false)}
            onDone={(number) => {
              setUploading(false);
              void studio.reload();
              if (number) navigate(`${ROOT}/${number}`);
            }}
          />
        ) : piece ? (
          <PieceView w={piece} use={u(piece)} now={now} onSaved={() => void studio.reload()} />
        ) : pieceId ? (
          <EmptyState icon="portfolio" title="There’s no piece with that number." action={<Link to={ROOT} className="font-semibold text-burgundy hover:underline">Back to the portfolio</Link>} />
        ) : (
          <EmptyState icon="portfolio" title="Choose a piece" className="min-h-80 @max-[64rem]:hidden">
            Its photograph, what’s confirmed about it, and where it’s used appear here.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

type Usage = { inquiries: ReturnType<typeof inquiriesFromPiece>; posts: { slug: string; title: string }[]; calls: { slug: string; title: string }[] };

function PieceView({ w, use, now, onSaved }: { w: StudioWork; use: Usage; now: Date; onSaved: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [w.id]);
  const sample = [
    ['Style', w.style?.map(traitLabel).join(', ')],
    ['Subject', w.subject?.map(traitLabel).join(', ')],
    ['Placement', w.placement && traitLabel(w.placement)],
    ['Colour', w.colour && traitLabel(w.colour)],
    ['Mood', w.mood?.map(traitLabel).join(', ')],
    ['Tags', w.tags?.join(', ')],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article aria-labelledby="pieceTitle" className="studio-card grid min-w-0 gap-0 overflow-hidden">
      <div className="bg-(--studio-sunken)">
        <ResponsiveImage image={w.image} alt={w.alt} ratio="4 / 5" fit="contain" sizes="(min-width: 1024px) 28rem, 100vw" priority />
      </div>
      <div className="grid gap-5 p-5">
        <div>
          <Link to={ROOT} className={button('ghost', 'sm', '-ml-3 mb-1 @min-[64rem]:hidden')}>
            <DashIcon name="arrow" className="rotate-180" />
            All pieces
          </Link>
          <p className="text-[0.8125rem] font-semibold text-ink-muted">Piece {w.id}</p>
          <h2 id="pieceTitle" ref={heading} tabIndex={-1} className="studio-title text-[1.75rem] leading-tight outline-none">
            {w.title} {w.id}
          </h2>
          {w.published && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/work/${w.slug}`} target="_blank" rel="noreferrer" className={button('secondary', 'sm')}>
                View on the public site
                <DashIcon name="external" />
              </a>
            </div>
          )}
          <PieceEditor key={w.uuid + w.title + w.metadataStatus + String(w.published)} w={w} onSaved={onSaved} />
        </div>

        <section aria-labelledby="pieceDetails">
          <h3 id="pieceDetails" className="type-heading text-[1rem]">
            Details
          </h3>
          {w.metadataStatus === 'verified' ? (
            <p data-tone="success" className="mt-2 flex items-start gap-2 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2.5 text-[0.875rem] leading-snug text-ink">
              <DashIcon name="check" className="mt-0.5 size-4 shrink-0 text-(--st-fg)" />
              <span>
                <span className="font-semibold text-(--st-fg)">Confirmed.</span> {w.description ?? 'No description written.'}
              </span>
            </p>
          ) : (
            <p data-tone="attention" className="mt-2 flex items-start gap-2 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2.5 text-[0.875rem] leading-snug text-ink">
              <DashIcon name="alert" className="mt-0.5 size-4 shrink-0 text-(--st-fg)" />
              <span>
                <span className="font-semibold text-(--st-fg)">Not confirmed yet.</span> The site shows this piece by number, and states nothing about it as fact until you confirm its details.
              </span>
            </p>
          )}
          {sample.length > 0 && w.metadataStatus !== 'verified' && (
            <details className="group mt-2 rounded-(--studio-r-md) border border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-(--studio-r-md) px-3 py-2.5 text-[0.875rem] font-semibold text-ink-soft hover:bg-(--studio-hover) focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid">
                Sample values used to build Find Similar
                <DashIcon name="arrow" className="size-4 rotate-90 transition-transform group-open:-rotate-90 motion-reduce:transition-none" />
              </summary>
              <div className="border-t border-rule px-3 py-3">
                <p className="text-[0.8125rem] leading-snug text-ink-muted">Fictional, assigned for testing — they don’t describe this photograph and must not be published.</p>
                <dl className="mt-2 grid gap-1.5 text-[0.875rem]">
                  {sample.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="text-ink-soft line-through decoration-(--studio-line-strong)">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          )}
        </section>

        <section aria-labelledby="pieceAsked">
          <h3 id="pieceAsked" className="type-heading text-[1rem]">
            Inquiries that started here
          </h3>
          {use.inquiries.length === 0 ? (
            <p className="mt-1.5 text-[0.875rem] text-ink-soft">No one has started Find Similar from this piece yet.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {use.inquiries.map((q) => (
                <li key={q.id}>
                  <Link to={inquiryPath(q)} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2 transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink group-hover:text-burgundy">{q.clientName}</span>
                      <span className="block truncate text-[0.8125rem] text-ink-muted">
                        {q.summary.concept ?? 'No idea described'} · {ago(now, q.receivedAt)}
                      </span>
                    </span>
                    <StatusBadge status={q.status} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pieceUsed">
          <h3 id="pieceUsed" className="type-heading text-[1rem]">
            Shown in
          </h3>
          {use.posts.length + use.calls.length === 0 ? (
            <p className="mt-1.5 text-[0.875rem] text-ink-soft">No journal post or canvas call shows this piece.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {use.posts.map((p) => (
                <li key={p.slug}>
                  <Link to={`${STUDIO_ROOT}/publishing/journal/${p.slug}`} className="flex items-center gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2 text-[0.875rem] font-semibold text-ink transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                    <span className="rounded-full bg-(--studio-sunken) px-2 py-0.5 text-[0.6875rem] text-ink-soft">Journal</span>
                    <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
              {use.calls.map((c) => (
                <li key={c.slug}>
                  <Link to={`${STUDIO_ROOT}/publishing/calls/${c.slug}`} className="flex items-center gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2 text-[0.875rem] font-semibold text-ink transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                    <span className="rounded-full bg-(--studio-sunken) px-2 py-0.5 text-[0.6875rem] text-ink-soft">Canvas call</span>
                    <span className="truncate">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
