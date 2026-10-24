import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * A small set of mutually exclusive choices - a view, a period, a tab -
 * as pressed buttons on an inset track (the Overview's period switch).
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex max-w-full flex-wrap gap-0.5 rounded-(--studio-r-md) bg-(--studio-sunken) p-1 ring-1 ring-(--studio-line) ring-inset', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-(--studio-r-sm) px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid aria-pressed:bg-(--studio-raised) aria-pressed:text-ink aria-pressed:shadow-(--studio-shadow) motion-reduce:transition-none"
        >
          {o.label}
          {o.count !== undefined && <span className="rounded-full bg-(--studio-sunken) px-1.5 text-[0.75rem] text-ink-muted tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
