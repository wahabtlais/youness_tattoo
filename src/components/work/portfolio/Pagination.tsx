import { pageItems } from '../../../lib/pagination';
import { cx } from '../../../lib/cx';

interface PaginationProps {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** what is being paged, for the landmark's name */
  label: string;
}

/**
 * Numbered pages: Previous, the numbers (with gaps when there are many),
 * Next. The current page is marked (aria-current) and Previous / Next are
 * disabled at the ends. Not rendered at all for a single page - no
 * meaningless "1". Narrow screens keep the arrows' words short.
 */
export function Pagination({ page, pages, onPage, label }: PaginationProps) {
  if (pages <= 1) return null;
  const step = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-3 type-label transition-colors duration-(--duration-fast)';
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={cx(step, 'border-ink/30 text-ink hover:border-ink disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-soft/50')}
      >
        <span aria-hidden="true">&larr;</span>
        <span className="max-tablet:sr-only">Previous</span>
      </button>
      <ol className="flex items-center gap-1.5">
        {pageItems(page, pages).map((n, i) =>
          n === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 type-label text-ink-soft">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                onClick={() => onPage(n)}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`Page ${n}`}
                className={cx(
                  step,
                  n === page ? 'border-burgundy bg-burgundy text-paper' : 'border-transparent text-ink hover:border-ink/40',
                )}
              >
                {n}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
        className={cx(step, 'border-ink/30 text-ink hover:border-ink disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-soft/50')}
      >
        <span className="max-tablet:sr-only">Next</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}
