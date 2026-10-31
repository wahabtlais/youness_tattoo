import { useId } from 'react';
import { cx } from '../../lib/cx';
import { useChartCursor } from './chartKit';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** share of the whole, 0..1 */
  share: number;
  /** drawn in the neutral, set back (e.g. closed inquiries) */
  muted?: boolean;
  /** a heading above this row, starting a group ("Closed · 21") */
  group?: string;
  /** its stage, for its colour (studio.css data-status) */
  status?: string;
}

const pct = (s: number) => `${Math.round(s * 100)}%`;

/**
 * Horizontal bars on one grid, so every row lines up: the label column is
 * as wide as the longest name (none is ever cut), then the bar, the count
 * and the share in their own aligned columns - no value depends on colour
 * or on hovering. Bars are 10px pills on a track, scaled to the largest
 * row, in the row's stage colour when it has one (else the chart marks);
 * muted rows (closed outcomes) are set back under their own heading.
 * Hover or arrow keys light the row being read.
 */
export function BarList({ rows, label }: { rows: BarRow[]; label: string }) {
  const cursor = useChartCursor(rows.length);
  const id = useId();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const a = cursor.active;

  return (
    <div>
      <div {...cursor.focusProps} role="group" aria-label={`${label}. Use the arrow keys to read each row.`} aria-describedby={`${id}-table`} className="rounded-(--studio-r-md) outline-offset-4" onPointerLeave={cursor.leave}>
        <ul aria-hidden="true" className="grid grid-cols-[max-content_minmax(2.5rem,1fr)_2.5ch_4ch] items-center gap-x-3">
          {rows.map((r, i) => (
            <li key={r.key} data-status={r.status} className="col-span-4 grid grid-cols-subgrid" onPointerMove={() => cursor.point(i)}>
              {r.group && (
                <p className={cx('col-span-4 mb-1 text-[0.8125rem] font-semibold text-ink-muted', i > 0 && 'mt-3 border-t border-dashed border-(--studio-line-strong) pt-3')}>{r.group}</p>
              )}
              <div className={cx('col-span-4 -mx-2 grid grid-cols-subgrid items-center rounded-(--studio-r-sm) px-2 py-1.5 transition-colors', a === i && 'bg-(--studio-hover)')}>
                <span className={cx('flex items-center gap-2 text-[0.9375rem] whitespace-nowrap', r.muted ? 'text-ink-soft' : 'font-medium text-ink')}>
                  {r.status && <span className="size-2.5 shrink-0 rounded-full bg-(--st-solid)" />}
                  {r.label}
                </span>
                <span className="flex h-2.5 items-center rounded-full bg-(--studio-sunken)">
                  {r.value > 0 ? (
                    <span className={cx('h-2.5 rounded-full', r.status ? 'bg-(--st-solid)' : r.muted ? 'bg-(--studio-mark-neutral)' : 'bg-(--studio-mark)', r.muted && r.status && 'opacity-70')} style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
                  ) : null}
                </span>
                <span className="text-right text-[0.9375rem] font-bold text-ink tabular-nums">{r.value}</span>
                <span className="text-right text-[0.8125rem] text-ink-muted tabular-nums">{pct(r.share)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p aria-live="polite" className="sr-only">
        {a !== null && cursor.keyboard ? `${rows[a].label}: ${rows[a].value}, ${pct(rows[a].share)}` : ''}
      </p>
      {/* a table ignores sr-only's 1px box: the wrapper hides it */}
      <div className="sr-only">
        <table id={`${id}-table`}>
          <caption>{label}</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td>
                  {r.value} ({pct(r.share)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
