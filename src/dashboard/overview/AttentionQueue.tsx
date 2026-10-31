import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { attention, type Urgency } from '../analytics';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import type { Overview } from '../types';
import { Panel } from './Panel';

/** each urgency's tone, mark and word - never colour alone. Late is danger, today and waiting are attention, the rest calm */
const URGENCY: Record<Urgency, { icon: DashIconName; label: string; tone: 'danger' | 'attention' | 'info' | 'neutral' }> = {
  overdue: { icon: 'alert', label: 'Overdue', tone: 'danger' },
  today: { icon: 'clock', label: 'Due today', tone: 'attention' },
  waiting: { icon: 'inquiries', label: 'Waiting', tone: 'attention' },
  prepare: { icon: 'prepare', label: 'Prepare', tone: 'info' },
  confirm: { icon: 'calendar', label: 'To confirm', tone: 'info' },
  new: { icon: 'inquiries', label: 'New', tone: 'neutral' },
};

const LIMIT = 5;

/**
 * What needs Younes, most urgent first (analytics.attention): late
 * follow-ups, today's, inquiries left waiting, appointments to prepare or
 * confirm, and the new inquiries counted in one line. The panel leads with
 * a count of what's late; each row carries its urgency's tone along its
 * edge and as a labelled chip, the task in bold, who it's for under it, and
 * when on the right. Late rows sit on their tone's wash; routine rows stay
 * calm. Each row opens the inquiry, or the part of the studio it belongs to.
 */
export function AttentionQueue({ o, now, className }: { o: Overview; now: Date; className?: string }) {
  const items = attention(o, now);
  const shown = items.slice(0, LIMIT);
  const late = items.filter((i) => i.urgency === 'overdue').length;
  const today = items.filter((i) => i.urgency === 'today').length;
  return (
    <Panel
      id="studioAttention"
      title="Needs your attention"
      icon={late ? 'alert' : 'bell'}
      tone={late ? 'danger' : today ? 'attention' : 'neutral'}
      urgent={late > 0}
      context={`${items.length} ${items.length === 1 ? 'item' : 'items'} · most urgent first`}
      className={className}
    >
      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center py-8 text-center" data-tone="success">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-(--st-bg) text-(--st-fg)">
              <DashIcon name="check" className="size-5" />
            </span>
            <p className="mt-3 type-heading text-[1.05rem]">All clear.</p>
            <p className="mt-1 text-body text-ink-soft">Nothing is waiting on you.</p>
          </div>
        </div>
      ) : (
        <>
          {(late > 0 || today > 0) && (
            <p className="mb-3 flex flex-wrap gap-2">
              {late > 0 && (
                <span data-tone="danger" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-(--st-bg) px-2.5 text-[0.8125rem] font-semibold text-(--st-fg)">
                  <DashIcon name="alert" className="size-3.5" />
                  {late} overdue
                </span>
              )}
              {today > 0 && (
                <span data-tone="attention" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-(--st-bg) px-2.5 text-[0.8125rem] font-semibold text-(--st-fg)">
                  <DashIcon name="clock" className="size-3.5" />
                  {today} due today
                </span>
              )}
            </p>
          )}
          <ul className="grid gap-2">
            {shown.map((it) => {
              const u = URGENCY[it.urgency];
              const loud = u.tone === 'danger';
              return (
                <li key={it.id} data-tone={u.tone}>
                  <Link
                    to={it.to}
                    className={cx(
                      'group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 overflow-hidden rounded-(--studio-r-md) border py-2.5 pr-3 pl-4 transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
                      loud ? 'border-(--st-line) bg-(--st-bg) hover:border-(--st-solid)' : 'border-rule bg-(--studio-panel) hover:border-(--studio-line-strong) hover:bg-(--studio-hover)',
                    )}
                  >
                    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--st-solid)" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-(--st-fg)">
                          <DashIcon name={u.icon} className="size-3.5" />
                          {u.label}
                        </span>
                        {it.when && it.when !== u.label && <span className="text-[0.75rem] font-medium text-ink-muted">· {it.when}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.9375rem] leading-snug font-semibold text-ink" title={it.title}>
                        {it.title}
                      </span>
                      <span className="block truncate text-[0.875rem] leading-snug text-ink-soft">{it.detail}</span>
                    </span>
                    <DashIcon name="arrow" className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-burgundy motion-reduce:transition-none" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {items.length > LIMIT && <p className="mt-3 text-[0.8125rem] font-medium text-ink-muted">+ {items.length - LIMIT} more, less urgent</p>}
    </Panel>
  );
}
