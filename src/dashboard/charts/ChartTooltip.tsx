import type { CSSProperties, ReactNode } from 'react';

/**
 * A chart's hover / focus readout: the value first and strong, its label
 * after and quieter, on a raised sheet in the current theme. Placed by the
 * chart (`style`) over the mark being read. It enhances, never gates -
 * every value is also in the chart's table.
 */
export function ChartTooltip({ style, value, label, extra }: { style: CSSProperties; value: ReactNode; label: ReactNode; extra?: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max max-w-56 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-raised) px-3 py-2 shadow-(--studio-shadow-lift)"
      style={style}
    >
      <p className="text-body font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.8125rem] leading-normal text-ink-soft">{label}</p>
      {extra && <div className="mt-1.5 border-t border-rule pt-1.5 text-body leading-snug text-ink-soft">{extra}</div>}
    </div>
  );
}
