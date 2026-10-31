import { useState } from 'react';
import { Link } from 'react-router';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { today } from '../../lib/date';
import { kpis, overviewRecords, workload } from '../analytics';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { dayTitle, greeting, plural } from '../format';
import { AttentionQueue } from '../overview/AttentionQueue';
import { InquiryActivity } from '../overview/InquiryActivity';
import { KpiCards } from '../overview/KpiCards';
import { PipelinePanel } from '../overview/PipelinePanel';
import { RecentActivity } from '../overview/RecentActivity';
import { WorkloadPanel } from '../overview/WorkloadPanel';
import { useOverview } from '../useOverview';

/**
 * /studio - the studio at a glance. A compact header (the day, and what's
 * pressing as three coloured facts), four figures, then a 12-column grid read left to right, top to
 * bottom: inquiry activity beside what needs attention; then the studio's
 * workload (chart and next appointments) beside the pipeline with recent
 * activity under it. The assistant is a page of its own, opened from the
 * top bar. In a narrower
 * workspace the panels stack in that order. Every figure is counted from
 * the same records (analytics.overviewRecords) - the real ones: sample
 * records are left out of every figure, chart and the attention queue,
 * unless "Include sample data" is switched on (for trying the studio out;
 * off on every visit, and said plainly while on). The samples stay listed,
 * labelled, on the pages they belong to.
 */
export function OverviewPage() {
  useDocumentTitle('Studio overview');
  // one "now" for the visit, so every relative time on the page agrees
  const [now] = useState(() => new Date());
  const overview = useOverview(now);
  const [withSamples, setWithSamples] = useState(false);

  if (overview.status !== 'success') {
    return <StateMessage kind={overview.status === 'loading' ? 'loading' : 'error'} title="The overview couldn’t be loaded." />;
  }
  const o = overview.data;
  const shown = overviewRecords(o, withSamples);
  const k = kpis(shown, now);
  const todayCount = workload(shown, now)[0].appointments.length;
  const chips = [
    { tone: k.newInquiries ? 'attention' : 'neutral', icon: 'inquiries', text: k.newInquiries ? `${plural(k.newInquiries, 'new inquiry', 'new inquiries')} to review` : 'No new inquiries', to: '/studio/inquiries/new' },
    { status: 'booking', icon: 'calendar', text: todayCount ? `${plural(todayCount, 'appointment')} today` : 'Nothing booked today' },
    ...(k.overdue ? [{ tone: 'danger', icon: 'alert', text: `${plural(k.overdue, 'follow-up')} overdue` }] : []),
  ] as { tone?: string; status?: string; icon: DashIconName; text: string; to?: string }[];

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-medium text-ink-muted">
            <time dateTime={today()}>{dayTitle(now)}</time> · {greeting(now)}, Younes
          </p>
          <h1 className="mt-1 studio-title text-[clamp(1.9rem,2.6vw,2.5rem)] leading-tight">Studio overview</h1>
          {/* the day in three facts, most pressing last-to-first in colour */}
          <ul aria-label="Today at a glance" className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => {
              const body = (
                <>
                  <DashIcon name={c.icon} className="size-4" />
                  {c.text}
                  {c.to && <DashIcon name="arrow" className="size-3.5 opacity-70" />}
                </>
              );
              const cls = 'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--st-line) bg-(--st-bg) px-3 text-[0.875rem] font-semibold text-(--st-fg)';
              return (
                <li key={c.text} {...(c.status ? { 'data-status': c.status } : { 'data-tone': c.tone })}>
                  {c.to ? (
                    <Link to={c.to} className={`${cls} transition-[border-color] hover:border-(--st-solid)`}>
                      {body}
                    </Link>
                  ) : (
                    <span className={cls}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {o.demo && (
          <div className="flex flex-wrap items-center gap-2">
            <p
              role="status"
              data-tone={withSamples ? 'attention' : 'brand'}
              className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-[0.8125rem] font-semibold text-(--st-fg) ${withSamples ? 'border-(--st-line) bg-(--st-bg)' : 'border-dashed border-(--st-line)'}`}
            >
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-(--st-solid)" />
              {withSamples ? 'Sample data included — these figures aren’t real business' : 'Sample records are listed, not counted in these figures'}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={withSamples}
              onClick={() => setWithSamples((v) => !v)}
              className="group inline-flex min-h-8 items-center gap-2 rounded-full border border-(--studio-line-strong) px-3 text-[0.8125rem] font-semibold text-ink-soft transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid motion-reduce:transition-none"
            >
              <span aria-hidden="true" className="relative h-4 w-7 shrink-0 rounded-full bg-(--studio-line-strong) transition-colors group-aria-checked:bg-burgundy motion-reduce:transition-none">
                <span className="absolute top-0.5 left-0.5 size-3 rounded-full bg-(--studio-panel) shadow-(--studio-shadow) transition-transform group-aria-checked:translate-x-3 motion-reduce:transition-none" />
              </span>
              Include sample data
            </button>
          </div>
        )}
      </header>

      <KpiCards k={k} now={now} withSamples={withSamples} />

      <div className="grid gap-5 @min-[56rem]:grid-cols-12">
        <InquiryActivity o={shown} now={now} className="@min-[56rem]:col-span-8" />
        <AttentionQueue o={shown} now={now} className="@min-[56rem]:col-span-4" />
        {/* the workload spans two rows beside the pipeline and recent activity, stacked */}
        <WorkloadPanel o={shown} now={now} className="@min-[56rem]:col-span-8 @min-[56rem]:row-span-2" />
        <PipelinePanel o={shown} className="@min-[56rem]:col-span-4" />
        <RecentActivity o={o} now={now} className="@min-[56rem]:col-span-4" />
      </div>
    </div>
  );
}
