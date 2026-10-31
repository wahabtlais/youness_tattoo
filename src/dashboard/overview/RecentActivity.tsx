import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { ago, fullDate } from '../format';
import type { ActivityActor, Overview } from '../types';
import { Panel } from './Panel';

/** who did it: a name, an icon and a tone each - the assistant in the brand colour */
const ACTOR: Record<ActivityActor, { name: string; icon: DashIconName; tone: string }> = {
  you: { name: 'You', icon: 'account', tone: 'accent' },
  assistant: { name: 'Assistant', icon: 'sparkles', tone: 'brand' },
  website: { name: 'Website', icon: 'external', tone: 'neutral' },
};

/**
 * What happened lately, newest first: who (an icon chip and their name),
 * what, and when - each in its own place, so a row reads at a glance.
 * Secondary, so kept short: three entries.
 */
export function RecentActivity({ o, now, className }: { o: Overview; now: Date; className?: string }) {
  const latest = [...o.activity].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 3);
  return (
    <Panel id="studioRecent" title="Recent activity" icon="clock" context="Latest first" className={className}>
      {latest.length === 0 ? (
        <p className="py-4 text-body text-ink-soft">Nothing yet. Inquiries, bookings and the assistant’s drafts will be logged here.</p>
      ) : (
        <ol className="grid gap-3">
          {latest.map((a) => {
            const who = ACTOR[a.actor];
            return (
              <li key={a.id} data-tone={who.tone} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-(--st-bg) text-(--st-fg)">
                  <DashIcon name={who.icon} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.875rem] font-semibold text-ink">{who.name}</span>
                    <time dateTime={a.at} title={fullDate(a.at)} className="text-[0.8125rem] whitespace-nowrap text-ink-muted">
                      {ago(now, a.at)}
                    </time>
                  </p>
                  <p className="text-[0.875rem] leading-snug text-ink-soft">{a.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
