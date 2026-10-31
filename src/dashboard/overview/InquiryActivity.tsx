import { useState } from 'react';
import { countTicks, inquirySeries, seriesStats, WINDOW_WEEKS, type ActivityPeriod } from '../analytics';
import { BarChart } from '../charts/BarChart';
import { plural, shortDate } from '../format';
import type { Overview } from '../types';
import { Panel } from './Panel';

const PERIODS: { value: ActivityPeriod; label: string }[] = [
  { value: 'weeks', label: `${WINDOW_WEEKS} weeks` },
  { value: 'days', label: '30 days' },
];

/**
 * How many inquiries arrived, over time - per week across the 12 weeks the
 * records cover, or per day across the last 30, both counted from the same
 * records as the pipeline and the KPI cards. The columns fill the height
 * the row gives them; under them, the period in three figures.
 */
export function InquiryActivity({ o, now, className }: { o: Overview; now: Date; className?: string }) {
  const [period, setPeriod] = useState<ActivityPeriod>('weeks');
  const weekly = period === 'weeks';
  const series = inquirySeries(o, now, period);
  const stats = seriesStats(series);
  const span = (p: (typeof series)[number]) => (weekly ? `${shortDate(p.date)} – ${shortDate(p.end)}` : shortDate(p.date));

  return (
    <Panel
      id="studioActivityChart"
      title="Inquiry activity"
      icon="inquiries"
      tone="accent"
      context={`${plural(stats.total, 'inquiry', 'inquiries')} received in the last ${weekly ? `${WINDOW_WEEKS} weeks` : '30 days'}`}
      className={className}
      action={
        <div role="group" aria-label="Period" className="inline-flex rounded-(--studio-r-md) bg-(--studio-sunken) p-1 ring-1 ring-(--studio-line) ring-inset">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className="min-h-8 rounded-(--studio-r-sm) px-3 text-[0.8125rem] font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid aria-pressed:bg-(--studio-raised) aria-pressed:text-ink aria-pressed:shadow-(--studio-shadow) motion-reduce:transition-none"
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {stats.total === 0 ? (
        <div className="grid min-h-48 flex-1 place-items-center rounded-(--studio-r-sm) border border-dashed border-(--studio-line-strong) text-center">
          <div>
            <p className="type-heading text-[1.1rem]">No inquiries in this period.</p>
            <p className="mt-1 text-body text-ink-soft">Consultations sent from the website are counted here.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <BarChart
              fill
              height={190}
              unitLabel={weekly ? 'Inquiries per week' : 'Inquiries per day'}
              label={`Inquiries received ${weekly ? 'per week, last 12 weeks' : 'per day, last 30 days'}`}
              yTicks={countTicks(Math.max(...series.map((p) => p.value)))}
              // weeks: every other date where narrow, every one where wide; days: one a week, from today back
              tickEvery={weekly ? 2 : 7}
              wideTickEvery={weekly ? 1 : undefined}
              values={weekly ? 'all' : 'last'}
              columns={series.map((p, i) => ({
                key: p.date.toISOString(),
                tick: shortDate(p.date),
                name: weekly ? `Week of ${span(p)}` : span(p),
                value: p.value,
                display: String(p.value),
                long: plural(p.value, 'inquiry', 'inquiries'),
                current: i === series.length - 1,
              }))}
            />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              [weekly ? 'This week' : 'Today', String(stats.latest.value), stats.latest.value === 1 ? 'inquiry' : 'inquiries', true],
              [weekly ? 'Weekly average' : 'Daily average', stats.average.toFixed(1), weekly ? 'a week' : 'a day', false],
              [weekly ? 'Busiest week' : 'Busiest day', String(stats.peak.value), `${weekly ? 'week of ' : ''}${shortDate(stats.peak.date)}`, false],
            ].map(([k, v, unit, current]) => (
              <div key={String(k)} className="min-w-0 rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2.5">
                <dt className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-ink-muted">
                  {current && <span aria-hidden="true" className="size-2 shrink-0 rounded-[3px] bg-(--studio-mark)" />}
                  {k}
                </dt>
                <dd className="mt-1 flex min-w-0 items-baseline gap-1.5">
                  <span className="text-[1.35rem] leading-none font-bold text-ink tabular-nums">{v}</span>
                  <span className="truncate text-[0.8125rem] text-ink-muted">{unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Panel>
  );
}
