import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cx } from '../../lib/cx';
import { WINDOW_WEEKS } from '../analytics';
import { DashIcon } from '../DashIcon';
import { plural } from '../format';
import { ALL, CATEGORIES, categoryBySlug, slugOf, type Category } from '../inquiries/categories';
import { InquiryDetail } from '../inquiries/InquiryDetail';
import { InquiryGraph, type CategoryFacts } from '../inquiries/InquiryGraph';
import { placementLine, searchable } from '../inquiries/inquiryText';
import { CategoryPanel, ExplorePanel, type Sort } from '../inquiries/MapPanels';
import { SearchField } from '../inquiries/SearchField';
import { StatusBadge } from '../inquiries/StatusBadge';
import { useSearchText } from '../inquiries/useSearchText';
import { STUDIO_ROOT } from '../navigation';
import type { InquiryRecord } from '../types';
import { button } from '../ui';
import { useOverview } from '../useOverview';

const ROOT = `${STUDIO_ROOT}/inquiries`;
const SORTS: Sort[] = ['newest', 'oldest', 'name'];
const RESULTS = 6;

/**
 * /studio/inquiries - the inquiry map, and each inquiry's own page:
 *   /studio/inquiries               the map, an explore panel beside it (?find searches the map)
 *   /studio/inquiries/:stage        the map, that stage's inquiries in the panel (?q, ?sort)
 *   /studio/inquiries/:inquiryId    one inquiry, full width (?from: the stage it was opened from,
 *                                   with its search and sort, for the way back and previous / next)
 *
 * Stage slugs and inquiry ids never collide (inquiry ids are "demo-inq-…").
 * One route component for all of it, so the prototype state - a changed
 * status, private notes - lasts across the views for this visit, in this
 * tab, and is gone on refresh. Every count comes from the Overview's own
 * demo records, the same ones the lists and pages show.
 *
 * The map view fills exactly the height the dashboard leaves it (the
 * shell's named padding), so the page never scrolls under the top bar.
 */
export function InquiriesPage() {
  const [now] = useState(() => new Date());
  const overview = useOverview(now);
  const reducedMotion = useReducedMotion();
  const { category: segment, inquiryId: legacyId } = useParams();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  // two searches: the map's (?find, across everything) and the open stage's (?q)
  const [find, setFind] = useSearchText('find');
  const [text, setText] = useSearchText('q');
  const [resultsOpen, setResultsOpen] = useState(false);
  // the view the panel was hidden in: opening another stage brings it back
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);

  const records: InquiryRecord[] = useMemo(
    () => (overview.status === 'success' ? overview.data.inquiries : []),
    [overview],
  );
  const stage = categoryBySlug(segment);
  const inquiry = !stage && segment ? records.find((q) => q.id === segment) : undefined;
  // the stage an open inquiry was reached from - else its own
  const from = inquiry ? (categoryBySlug(params.get('from') ?? undefined) ?? categoryBySlug(slugOf(inquiry.status))!) : undefined;

  useDocumentTitle(inquiry ? `${inquiry.clientName} · Inquiries` : stage ? `${stage.label} · Inquiries` : 'Inquiries');

  if (overview.status !== 'success') {
    return <StateMessage kind={overview.status === 'loading' ? 'loading' : 'error'} title="The inquiries couldn’t be loaded." />;
  }
  // an older address, /studio/inquiries/:stage/:id, is the inquiry's page now
  if (segment && legacyId) {
    const next = new URLSearchParams(search);
    next.set('from', segment);
    return <Navigate replace to={`${ROOT}/${legacyId}?${next}`} />;
  }

  const sort: Sort = SORTS.includes(params.get('sort') as Sort) ? (params.get('sort') as Sort) : 'newest';
  const set = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const matcher = (q: string) => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (r: InquiryRecord) => words.every((w) => searchable(r).includes(w));
  };
  const inStage = (c: Category) => (c.status ? records.filter((q) => q.status === c.status) : records);
  const listOf = (c: Category) =>
    inStage(c)
      .filter(matcher(text))
      .sort((a, b) => (sort === 'name' ? a.clientName.localeCompare(b.clientName, 'en', { numeric: true }) : (a.receivedAt < b.receivedAt ? 1 : -1) * (sort === 'oldest' ? -1 : 1)));
  // addresses, carrying what's worth keeping
  const qs = (keys: string[], extra: Record<string, string> = {}) => keep(search, keys, extra);
  const mapTo = `${ROOT}${qs(['find'])}`;
  const stageTo = (c: Category) => `${ROOT}/${c.slug}${qs(['find', 'q', 'sort'])}`;
  const inquiryTo = (q: InquiryRecord, c: Category) => `${ROOT}/${q.id}${qs(['find', 'q', 'sort'], { from: c.slug })}`;

  // ---- one inquiry, full width ----
  if (inquiry && from) {
    const list = listOf(from);
    const at = list.findIndex((q) => q.id === inquiry.id);
    const link = (q: InquiryRecord | undefined) => q && { to: inquiryTo(q, from), name: q.clientName };
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Back to={stageTo(from)} label={`Back to ${from.label}`} />
          <Crumbs trail={[{ label: 'Inquiries', to: mapTo }, { label: from.label, to: stageTo(from) }, { label: inquiry.clientName }]} />
        </div>
        <InquiryDetail
          key={inquiry.id}
          position={at >= 0 ? { index: at, total: list.length } : undefined}
          inquiry={inquiry}
          now={now}
          category={{ label: from.label, to: stageTo(from) }}
          prev={at > 0 ? link(list[at - 1]) : undefined}
          next={at >= 0 && at < list.length - 1 ? link(list[at + 1]) : undefined}
        />
      </div>
    );
  }

  // ---- an address that is neither a stage nor an inquiry ----
  if (segment && !stage) {
    return (
      <div className="grid gap-3">
        <Crumbs trail={[{ label: 'Inquiries', to: mapTo }, { label: 'Not found' }]} />
        <div className="grid min-h-72 place-items-center rounded-(--studio-r-lg) border border-dashed border-(--studio-line-strong) px-6 py-10 text-center">
          <div>
            <DashIcon name="inquiries" className="mx-auto size-6 text-ink-muted" />
            <h1 className="mt-2 type-heading text-[1.4rem]">There’s no inquiry or stage at this address.</h1>
            <p className="mt-1 text-body text-ink-soft">It may have been a sample that no longer exists.</p>
            <div className="mt-3">
              <Back to={mapTo} label="Back to the inquiry map" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- the map ----
  const findMatches = find.trim() ? records.filter(matcher(find)).sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)) : null;
  const facts: Record<string, CategoryFacts> = Object.fromEntries(
    [ALL, ...CATEGORIES].map((c) => {
      const items = inStage(c);
      return [
        c.slug,
        {
          count: items.length,
          latest: items.reduce<string | null>((l, q) => (!l || q.receivedAt > l ? q.receivedAt : l), null),
          matches: findMatches ? findMatches.filter((q) => c.status === null || q.status === c.status).length : null,
        },
      ];
    }),
  );
  const activeTotal = CATEGORIES.filter((c) => c.group === 'active').reduce((n, c) => n + facts[c.slug].count, 0);
  const panelOpen = hiddenFor !== (segment ?? '');

  return (
    <div className="flex flex-col gap-3 @min-[56rem]:h-[calc(100svh-var(--studio-bar)-var(--studio-main-top)-var(--studio-main-bottom))] @min-[56rem]:min-h-[34rem]">
      {/* one compact header, so the map gets the height: title and figures, the map's search, the demo notice */}
      <header className="relative z-30 flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <Crumbs trail={[{ label: 'Inquiries', to: stage ? mapTo : undefined }, ...(stage ? [{ label: stage.label }] : [])]} />
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="studio-title text-[clamp(1.75rem,2.4vw,2.2rem)] leading-tight">Inquiries</h1>
            <p className="text-body text-ink-soft">
              {records.length} in {WINDOW_WEEKS} weeks · {activeTotal} active · {records.length - activeTotal} closed ·{' '}
              <span data-tone="brand" className="font-semibold text-(--st-fg)">sample data</span>
            </p>
          </div>
        </div>
        {/* the map's search: lights the stages that hold matches, and lists them to open */}
        <div
          className="relative ml-auto w-full max-w-[22rem]"
          onFocus={() => setResultsOpen(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setResultsOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setResultsOpen(false);
          }}
        >
          <SearchField
            value={find}
            onChange={(v) => {
              setFind(v);
              setResultsOpen(true);
            }}
            label="Search the inquiry map"
            placeholder="Find a client or an idea on the map…"
          />
          {findMatches && resultsOpen && (
            <div className="absolute top-full right-0 left-0 mt-1 overflow-hidden rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-raised) shadow-(--studio-shadow-lift)">
              <p aria-live="polite" className="border-b border-rule px-3 py-2 text-[0.8125rem] font-medium text-ink-muted">
                {findMatches.length ? `${plural(findMatches.length, 'match', 'matches')} · lit on the map` : `Nothing found for “${find.trim()}”`}
              </p>
              {findMatches.length > 0 && (
                <ul className="max-h-72 divide-y divide-rule overflow-y-auto">
                  {findMatches.slice(0, RESULTS).map((q) => (
                    <li key={q.id}>
                      <Link
                        to={inquiryTo(q, categoryBySlug(slugOf(q.status))!)}
                        onClick={() => setResultsOpen(false)}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-2 hover:bg-(--studio-selected)"
                      >
                        <span className="truncate text-body text-ink">{q.clientName}</span>
                        <StatusBadge status={q.status} size="sm" />
                        <span className="col-span-2 truncate text-body text-ink-soft">
                          {q.summary.concept}
                          <span className="text-ink-muted"> · {placementLine(q.summary)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {findMatches.length > RESULTS && (
                <Link
                  to={`${ROOT}/all?q=${encodeURIComponent(find.trim())}&find=${encodeURIComponent(find.trim())}`}
                  onClick={() => setResultsOpen(false)}
                  className="flex min-h-10 items-center justify-end border-t border-rule px-3 text-[0.875rem] font-semibold text-burgundy hover:bg-(--studio-hover)"
                >
                  All {findMatches.length} in All inquiries →
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* the workspace: the map, and its panel beside it (a drawer over it, on a narrow screen) */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 @min-[56rem]:flex-row">
        <section aria-label="Inquiry map" className="relative flex h-[34rem] min-w-0 flex-col overflow-hidden studio-card @min-[56rem]:h-auto @min-[56rem]:flex-1">
          <div className="relative min-h-0 flex-1 bg-(--studio-sunken)">
            <InquiryGraph facts={facts} selected={stage?.slug ?? null} search={qs(['find'])} now={now} reducedMotion={reducedMotion} />
          </div>
          {/* how to read it: a strip under the drawing, never over a node */}
          <div className="shrink-0 border-t border-rule px-3 py-1.5">
            <Legend />
          </div>
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setHiddenFor(null)}
              className={button('secondary', 'sm', 'absolute top-3 left-3 z-10')}
            >
              <DashIcon name="arrow" className="size-3.5 rotate-180" />
              {stage ? `Show ${stage.label} · ${facts[stage.slug].count}` : 'Show the panel'}
            </button>
          )}
        </section>
        {panelOpen && (
          <aside
            aria-label={stage ? `${stage.label}: the inquiries` : 'Explore the map'}
            className={cx(
              'studio-card flex min-h-0 flex-col overflow-hidden @min-[56rem]:shrink-0',
              stage
                ? 'absolute inset-0 z-20 @min-[56rem]:static @min-[56rem]:w-[24rem] @min-[80rem]:w-[27rem]'
                : '@min-[56rem]:w-[19rem] @min-[80rem]:w-[21rem]',
            )}
          >
            {stage ? (
              <CategoryPanel
                category={stage}
                items={listOf(stage)}
                total={inStage(stage).length}
                text={text}
                onText={setText}
                sort={sort}
                onSort={(v) => set('sort', v === 'newest' ? null : v)}
                linkFor={(q) => inquiryTo(q, stage)}
                closeTo={mapTo}
                now={now}
                onHide={() => setHiddenFor(segment ?? '')}
              />
            ) : (
              <ExplorePanel
                total={records.length}
                active={activeTotal}
                closed={records.length - activeTotal}
                waiting={CATEGORIES.filter((c) => c.attention).map((c) => ({ label: c.label, count: facts[c.slug].count, to: stageTo(c), status: c.status ?? undefined }))}
                onHide={() => setHiddenFor(segment ?? '')}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/** the address's search with only the given keys kept, plus any extra ("?find=lion&from=new") */
function keep(search: string, keys: string[], extra: Record<string, string> = {}) {
  const from = new URLSearchParams(search);
  const next = new URLSearchParams();
  keys.forEach((k) => from.get(k) && next.set(k, from.get(k)!));
  Object.entries(extra).forEach(([k, v]) => next.set(k, v));
  const s = next.toString();
  return s ? `?${s}` : '';
}

function Crumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[0.8125rem] font-medium text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {trail.map((t, i) => (
          <li key={t.label} className="flex items-center gap-x-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {t.to ? (
              <Link to={t.to} className="hover:text-burgundy">
                {t.label}
              </Link>
            ) : (
              <span aria-current="page">{t.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** what the map means, in a few words */
function Legend() {
  return (
    <ul aria-label="How to read the map" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] font-medium text-ink-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-[3px] border border-(--studio-line-strong) bg-(--studio-sunken)" />
        Active pipeline
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-[3px] border border-dashed border-(--studio-line-strong)" />
        Closed outcomes
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 22 8" className="h-2 w-5.5 text-ink-muted">
          <path d="M0 4h18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 1l4 3-4 3z" fill="currentColor" />
        </svg>
        Arrow: the usual next step, not a rule
      </li>
    </ul>
  );
}

function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={button('secondary', 'sm', 'group')}>
      <DashIcon name="arrow" className="size-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
      {label}
    </Link>
  );
}
