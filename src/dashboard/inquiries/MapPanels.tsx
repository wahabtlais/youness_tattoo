import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import { ago, fullDate } from '../format';
import type { InquiryRecord } from '../types';
import type { Category } from './categories';
import { entryShort, placementLine } from './inquiryText';
import { button } from '../ui';
import { SearchField } from './SearchField';

export type Sort = 'newest' | 'oldest' | 'name';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Client A–Z' },
];

/** the panel's top controls: hide the panel, and - for a stage - close it back to the whole map */
function PanelBar({ label, onHide, closeTo, selected }: { label: string; onHide: () => void; closeTo?: string; selected?: boolean }) {
  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-rule pr-1.5 pl-4">
      {/* an open stage says so in the map's selection colour - the same violet as its node */}
      {selected ? (
        <p className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-burgundy">
          <span aria-hidden="true" className="size-2 rounded-full bg-burgundy" />
          Selected on the map · <span className="text-ink-muted">{label}</span>
        </p>
      ) : (
        <p className="text-[0.8125rem] font-semibold text-ink-muted">{label}</p>
      )}
      <div className="flex items-center">
        <button type="button" onClick={onHide} aria-label="Hide the panel" title="Hide the panel" className="grid size-9 place-items-center rounded-(--studio-r-md) text-ink-soft hover:bg-(--studio-hover) hover:text-ink">
          <DashIcon name="arrow" className="size-4" />
        </button>
        {closeTo && (
          <Link to={closeTo} aria-label="Close and return to the whole map" title="Close and return to the whole map" className="grid size-9 place-items-center rounded-(--studio-r-md) text-ink-soft hover:bg-(--studio-hover) hover:text-ink">
            <DashIcon name="close" className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Beside the map when no stage is open: what the map holds, in a few
 * figures, the stages that wait on Younes, and how to explore it.
 */
export function ExplorePanel({
  total,
  active,
  closed,
  waiting,
  onHide,
}: {
  total: number;
  active: number;
  closed: number;
  /** the stages that wait on Younes, with their counts and addresses */
  waiting: { label: string; count: number; to: string; status?: string }[];
  onHide: () => void;
}) {
  return (
    <>
      <PanelBar label="Explore" onHide={onHide} />
      <div className="grid gap-5 overflow-y-auto p-4">
        <div>
          <h2 className="type-heading text-[1.15rem] leading-tight">The inquiry map</h2>
          <p className="mt-1 text-body leading-snug text-ink-soft">Every inquiry from the last 12 weeks, by where it stands. Arrows show the usual next step, not a guaranteed one.</p>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {[
            ['Inquiries', total],
            ['Active', active],
            ['Closed', closed],
          ].map(([k, v]) => (
            <div key={k} className="rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2.5">
              <dt className="text-[0.8125rem] font-medium text-ink-muted">{k}</dt>
              <dd className="mt-1 text-[1.35rem] leading-none font-bold text-ink tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink-muted">Waiting on you</p>
          <ul className="mt-1.5 grid gap-1">
            {waiting.map((w) => (
              <li key={w.label} data-status={w.status}>
                <Link to={w.to} className="group flex min-h-10 items-center justify-between gap-3 rounded-(--studio-r-md) border border-rule px-3 transition-colors hover:border-(--st-line) hover:bg-(--st-bg)">
                  <span className="flex items-center gap-2 text-body font-medium text-ink">
                    <span aria-hidden="true" className="size-2.5 rounded-full bg-(--st-solid)" />
                    {w.label}
                  </span>
                  <span className="font-bold text-ink tabular-nums">{w.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <ul className="grid gap-2 border-t border-rule pt-3 text-body leading-snug text-ink-soft">
          <li>
            <span className="text-ink">Select a stage</span> to list its inquiries here.
          </li>
          <li>
            <span className="text-ink">Search</span> to find a client or an idea — stages with matches stay lit.
          </li>
          <li>
            <span className="text-ink">Open an inquiry</span> to read it in full, on its own page.
          </li>
          <li>
            <span className="text-ink">Drag</span> to move around; the controls zoom and fit the map.
          </li>
        </ul>
      </div>
    </>
  );
}

/**
 * Beside the map when a stage is open: its name, count and meaning, a
 * search within it, a sort, and a concise list of its inquiries - each
 * opening the inquiry on its own page.
 */
export function CategoryPanel({
  category,
  items,
  total,
  text,
  onText,
  sort,
  onSort,
  linkFor,
  closeTo,
  now,
  onHide,
}: {
  category: Category;
  items: InquiryRecord[];
  total: number;
  text: string;
  onText: (v: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  linkFor: (q: InquiryRecord) => string;
  closeTo: string;
  now: Date;
  onHide: () => void;
}) {
  return (
    <>
      <PanelBar label={category.group === 'closed' ? 'Closed outcome' : category.group === 'active' ? 'Active pipeline' : 'Every inquiry'} onHide={onHide} closeTo={closeTo} selected />
      <div className="shrink-0 border-b border-rule p-4">
        <h2 data-status={category.status ?? 'all'} className="flex items-center gap-2.5 type-heading text-[1.25rem] leading-tight">
          <span aria-hidden="true" className="size-3 rounded-full bg-(--st-solid)" />
          {category.label}
          <span className="rounded-full bg-(--st-bg) px-2 py-0.5 text-[0.875rem] font-bold text-(--st-fg) tabular-nums">{total}</span>
        </h2>
        <p className="mt-1 text-body leading-snug text-ink-soft">{category.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SearchField value={text} onChange={onText} label={`Search ${category.label.toLowerCase()}`} placeholder="Search by client or idea…" />
          <label className="flex min-h-10 items-center gap-2 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-field) px-2.5 text-[0.8125rem] font-medium text-ink-muted">
            Sort
            <select aria-label="Sort" value={sort} onChange={(e) => onSort(e.target.value as Sort)} className="min-h-9 bg-transparent text-body font-medium text-ink">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-(--studio-raised)">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p aria-live="polite" className="ml-auto text-[0.8125rem] font-medium text-ink-muted">
            {items.length === total ? `${total} ${total === 1 ? 'inquiry' : 'inquiries'}` : `${items.length} of ${total}`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="type-heading text-[1.05rem]">{total === 0 ? `No inquiries are ${category.label.toLowerCase()} right now.` : 'No inquiries match.'}</p>
            {total > 0 && (
              <button type="button" onClick={() => onText('')} className={button('secondary', 'sm', 'mt-3')}>
                Clear the search
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul aria-label={`${category.label}: inquiries`} className="min-h-0 flex-1 divide-y divide-rule overflow-y-auto">
          {items.map((q) => (
            <li key={q.id}>
              <Link to={linkFor(q)} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-3 transition-colors hover:bg-(--studio-selected)">
                <span className="truncate text-body font-semibold text-ink group-hover:text-burgundy">{q.clientName}</span>
                <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)} className="text-[0.8125rem] whitespace-nowrap text-ink-muted">
                  {ago(now, q.receivedAt)}
                </time>
                <span className={cx('col-span-2 truncate text-body leading-snug text-ink-soft')}>{q.summary.concept ?? 'No idea described yet'}</span>
                <span className="col-span-2 truncate text-[0.8125rem] text-ink-muted">{[placementLine(q.summary), entryShort(q.entry)].filter(Boolean).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
