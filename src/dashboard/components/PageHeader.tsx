import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * A dashboard page's head: an optional trail, the title in the brand
 * serif, one line saying what's here, the page's own controls at the
 * right, and - while the data is sample data - the demo mark, so no page
 * ever looks live when it isn't.
 */
export function PageHeader({
  title,
  summary,
  trail,
  actions,
  demo = true,
}: {
  title: string;
  summary?: ReactNode;
  trail?: { label: string; to?: string }[];
  actions?: ReactNode;
  demo?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {trail && (
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
        )}
        <h1 className="mt-1 studio-title text-[clamp(1.9rem,2.6vw,2.4rem)] leading-tight">{title}</h1>
        {summary && <p className="mt-1 max-w-[70ch] text-[0.9375rem] leading-snug text-ink-soft">{summary}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {demo && <DemoMark />}
      </div>
    </header>
  );
}

/** the sample-data mark, in the brand's dashed pill */
export function DemoMark({ children = 'Sample data — nothing here is live' }: { children?: ReactNode }) {
  return (
    <p data-tone="brand" className="inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-(--st-line) px-3 text-[0.8125rem] font-semibold text-(--st-fg)">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
      {children}
    </p>
  );
}
