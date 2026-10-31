import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useChartCursor } from './chartKit';
import { ChartTooltip } from './ChartTooltip';

export interface Column {
  key: string;
  /** under the column ("Aug 3", "Fri") - always given; `tickEvery` decides which are shown */
  tick: string;
  /** a second line under it ("23") */
  sub?: string;
  /** a second measure, written in its own row under the dates ("2") - see `noteLabel` */
  note?: string;
  /** its full name, for the tooltip and table ("Aug 3 – Aug 9") */
  name: string;
  value: number;
  /** the value as written on the cap ("5", "4.3 h") ... */
  display: string;
  /** ... and in full, for the tooltip and table ("5 inquiries") */
  long?: string;
  /** more for the tooltip */
  detail?: ReactNode;
  /** set apart (this week, today) */
  current?: boolean;
}

/**
 * One series in columns from a single baseline, laid out by the browser -
 * flex columns and percentage heights, no measuring - so it always fills
 * the space it's given and its labels can't pile up. Columns are at most
 * 28px wide with a 5px rounded cap, the current one (this week, today) and
 * the one being read in the stronger colour; a zero is drawn as a zero (a stub on
 * the baseline and its value), never as a gap. Hairline grid, the y-axis in
 * the chart's unit. Each column's whole band answers hover and focus; the
 * arrow keys walk the columns. A single series has no legend: the panel
 * names it. The same numbers are in a table for screen readers.
 *
 * `fill`: the plot grows to the height its container gives it (at least
 * `height`); otherwise it is `height` tall.
 */
export function BarChart({
  columns,
  yTicks,
  yFormat = String,
  unitLabel,
  label,
  tickEvery = 1,
  wideTickEvery,
  values = 'all',
  height = 200,
  fill,
  noteLabel,
  color = 'var(--studio-mark-soft)',
  currentColor = 'var(--studio-mark)',
}: {
  columns: Column[];
  /** the y-axis values, from 0 up; the last is the top of the plot */
  yTicks: number[];
  yFormat?: (n: number) => string;
  /** the y-axis unit, written above it ("inquiries", "hours") */
  unitLabel: string;
  /** what the chart shows, for assistive technology */
  label: string;
  /** label every n-th column (counting back from the latest) ... */
  tickEvery?: number;
  /** ... or every n-th where the chart is wide (44rem and up) */
  wideTickEvery?: number;
  /** values on the caps: every column, or only the latest (dense charts) */
  values?: 'all' | 'last';
  height?: number;
  fill?: boolean;
  /** names the row of notes, at the axis ("appts") */
  noteLabel?: string;
  /** the columns' colour, and the current one's (CSS colours; the studio's chart marks by default) */
  color?: string;
  currentColor?: string;
}) {
  const cursor = useChartCursor(columns.length);
  const id = useId();
  const top = yTicks[yTicks.length - 1] || 1;
  const last = columns.length - 1;
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  const a = cursor.active;
  // the tooltip sits over its column, kept inside the chart at the edges
  const tipAt = (i: number) => {
    const at = ((i + 0.5) / columns.length) * 100;
    return at < 18 ? { left: '0%' } : at > 82 ? { right: '0%' } : { left: `${at}%`, transform: 'translateX(-50%)' };
  };
  const shown = (i: number, every: number) => (last - i) % every === 0;

  return (
    <div className={cx('@container flex flex-col', fill && 'h-full')} style={{ '--bar': color, '--bar-current': currentColor } as CSSProperties}>
      <p aria-hidden="true" className="mb-1.5 text-[0.8125rem] leading-none font-medium text-ink-muted">
        {unitLabel}
      </p>
      <div
        {...cursor.focusProps}
        role="group"
        aria-label={`${label}. Use the arrow keys to read each column.`}
        aria-describedby={`${id}-table`}
        className={cx('grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-(--studio-r-md) outline-offset-4', fill && 'flex-1 grid-rows-[minmax(0,1fr)_auto_auto]')}
        onPointerLeave={cursor.leave}
      >
        {/* y-axis */}
        <div aria-hidden="true" className="relative mt-4 w-8" style={fill ? { minHeight: height } : { height }}>
          {yTicks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-[0.75rem] leading-none text-ink-muted tabular-nums" style={{ bottom: pct(t) }}>
              {yFormat(t)}
            </span>
          ))}
        </div>

        {/* the plot */}
        <div aria-hidden="true" className="relative mt-4" style={fill ? { minHeight: height } : { height }}>
          {yTicks.map((t) => (
            <span key={t} className={cx('absolute inset-x-0 h-px', t === 0 ? 'bg-(--studio-line-strong)' : 'bg-(--studio-grid)')} style={{ bottom: pct(t) }} />
          ))}
          <div className="absolute inset-0 flex">
            {columns.map((c, i) => (
              <div key={c.key} className="relative flex min-w-0 flex-1 items-end justify-center" onPointerMove={() => cursor.point(i)}>
                {a === i && <span className="absolute inset-x-0.5 -top-2 bottom-0 rounded-(--studio-r-sm) bg-(--studio-hover)" />}
                {c.value > 0 ? (
                  <span className={cx('relative w-[min(28px,64%)] rounded-t-[5px]', c.current || a === i ? 'bg-(--bar-current)' : 'bg-(--bar)')} style={{ height: pct(c.value) }} />
                ) : (
                  // a zero is a value: a stub on the baseline
                  <span className="relative h-[3px] w-[min(28px,64%)] rounded-full bg-(--studio-mark-neutral)" />
                )}
                {(values === 'all' || i === last) && (
                  <span
                    className={cx('absolute text-[0.75rem] leading-none whitespace-nowrap tabular-nums', c.value ? 'font-semibold text-ink' : 'font-medium text-ink-muted')}
                    style={{ bottom: `calc(${pct(c.value)} + 5px)` }}
                  >
                    {c.display}
                  </span>
                )}
              </div>
            ))}
          </div>
          {a !== null && (
            <ChartTooltip style={{ ...tipAt(a), bottom: `calc(${pct(columns[a].value)} + 1.6rem)` }} value={columns[a].long ?? columns[a].display} label={columns[a].name} extra={columns[a].detail} />
          )}
        </div>

        {/* x-axis labels, one cell per column so they can never overlap */}
        <span />
        <div aria-hidden="true" className="flex pt-1.5">
          {columns.map((c, i) => {
            const always = shown(i, tickEvery);
            const wide = wideTickEvery ? shown(i, wideTickEvery) : always;
            return (
              <span
                key={c.key}
                className={cx(
                  'min-w-0 flex-1 text-center text-[0.75rem] leading-tight whitespace-nowrap',
                  c.current ? 'font-bold text-ink' : 'text-ink-soft',
                  !always && (wide ? 'invisible @min-[44rem]:visible' : 'invisible'),
                  always && !wide && '@min-[44rem]:invisible',
                )}
              >
                {c.tick}
                {c.sub && <span className="block tabular-nums">{c.sub}</span>}
              </span>
            );
          })}
        </div>
        {noteLabel && (
          <>
            <span aria-hidden="true" className="w-8 pt-1.5 text-right text-[0.6875rem] leading-tight font-medium text-ink-muted">
              {noteLabel}
            </span>
            <div aria-hidden="true" className="flex pt-2">
              {columns.map((c) => (
                <span key={c.key} className="flex min-w-0 flex-1 justify-center">
                  <span className={cx('min-w-6 rounded-full px-1.5 py-0.5 text-center text-[0.75rem] leading-tight font-semibold tabular-nums', c.note && c.note !== '0' ? 'bg-(--studio-sunken) text-ink' : 'text-ink-muted')}>{c.note}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {a !== null && cursor.keyboard ? `${columns[a].name}: ${columns[a].long ?? columns[a].display}` : ''}
      </p>
      {/* a table ignores sr-only's 1px box: the wrapper hides it */}
      <div className="sr-only">
        <table id={`${id}-table`}>
          <caption>{label}</caption>
          <tbody>
            {columns.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.name}</th>
                <td>{c.long ?? c.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
