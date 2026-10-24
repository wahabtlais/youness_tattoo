import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { WINDOW_WEEKS, type Kpis } from '../analytics';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { clock, dayName, plural } from '../format';

interface Card {
  label: string;
  icon: DashIconName;
  value: string;
  /** what the number counts */
  unit: string;
  /** one line under the value */
  note: ReactNode;
  /** the period or comparison the data supports, said in full */
  foot?: { dir?: 'up' | 'down'; text: string };
  /** its meaning, as a tone (studio.css) or a stage colour */
  tone: { tone: string } | { status: string };
  /** strong: the note in the tone, an alert icon (something is late) */
  alert?: boolean;
  /** a share to draw as a meter, 0..1 */
  meter?: number;
  /** where the figure is dealt with: the whole card opens it */
  to?: string;
}

/**
 * The four figures that say where the studio stands, each counted from the
 * records (analytics.kpis). Each card has its own meaning colour - new
 * inquiries in the attention amber while any wait, appointments in the
 * booking teal, follow-ups in the danger tone only when one is overdue,
 * conversion in the accent with a meter - a large number with what it
 * counts, a line of context, and its period or comparison at the foot.
 */
export function KpiCards({ k, now }: { k: Kpis; now: Date }) {
  const delta = k.receivedThisWeek - k.receivedWeekBefore;
  const cards: Card[] = [
    {
      label: 'New inquiries',
      icon: 'inquiries',
      to: '/studio/inquiries/new',
      value: String(k.newInquiries),
      unit: 'to review',
      tone: { tone: k.newInquiries ? 'attention' : 'neutral' },
      note: k.newInquiries ? (k.oldestNewDays ? `Oldest waiting ${plural(k.oldestNewDays, 'day')}` : 'Arrived today') : 'None waiting — all reviewed',
      foot: { dir: delta > 0 ? 'up' : delta < 0 ? 'down' : undefined, text: `${k.receivedThisWeek} received in the last 7 days · ${k.receivedWeekBefore} the 7 before` },
    },
    {
      label: 'Upcoming appointments',
      icon: 'calendar',
      value: String(k.upcoming),
      unit: 'next 7 days',
      tone: { status: 'booking' },
      note: k.upcoming ? `${k.upcomingHours} h booked` : 'Nothing booked',
      foot: k.nextAppointment ? { text: `Next: ${dayName(now, k.nextAppointment.startsAt)}, ${clock(k.nextAppointment.startsAt)}` } : undefined,
    },
    {
      label: 'Outstanding follow-ups',
      icon: k.overdue ? 'alert' : 'reply',
      value: String(k.followUps),
      unit: 'open',
      tone: { tone: k.overdue ? 'danger' : k.dueToday ? 'attention' : 'neutral' },
      note: k.followUps ? [k.overdue && `${k.overdue} overdue`, k.dueToday && `${k.dueToday} due today`].filter(Boolean).join(' · ') || 'None due today' : 'No one is waiting on you',
      foot: { text: 'Replies you owe and reminders you set' },
      alert: k.overdue > 0,
    },
    {
      label: 'Inquiry to booking',
      icon: 'funnel',
      value: `${Math.round(k.conversion * 100)}%`,
      unit: 'converted',
      tone: { tone: 'accent' },
      note: `${k.booked} of ${k.received} reached a booking`,
      meter: k.conversion,
      foot: { text: `Inquiries received in the last ${WINDOW_WEEKS} weeks` },
    },
  ];

  return (
    <section aria-labelledby="studioKpis">
      <h2 id="studioKpis" className="sr-only">
        Key figures (sample data)
      </h2>
      <ul className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[62rem]:grid-cols-4">
        {cards.map((c) => (
          <li
            key={c.label}
            {...('tone' in c.tone ? { 'data-tone': c.tone.tone } : { 'data-status': c.tone.status })}
            className={cx(
              'studio-card group relative flex min-w-0 flex-col overflow-hidden p-4 pl-5',
              c.to && 'transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-(--st-line) hover:shadow-(--studio-shadow-lift) has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus has-[a:focus-visible]:outline-solid motion-reduce:hover:translate-y-0',
            )}
          >
            {/* the card's meaning: its colour down the edge, and as a wash in the corner */}
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--st-solid)" />
            <span aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-(--st-bg) opacity-70 blur-2xl" />
            <div className="relative flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-(--studio-r-md) bg-(--st-bg) text-(--st-fg)">
                <DashIcon name={c.icon} className="size-4" />
              </span>
              {c.to ? (
                // one link, stretched over the card
                <Link to={c.to} className="text-[0.875rem] font-semibold text-ink-soft outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-ink">
                  {c.label}
                  <span className="sr-only"> — open in Inquiries</span>
                </Link>
              ) : (
                <p className="text-[0.875rem] font-semibold text-ink-soft">{c.label}</p>
              )}
              {c.to && <DashIcon name="arrow" className="ml-auto size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-burgundy motion-reduce:transition-none" />}
            </div>
            <p className="relative mt-3 flex items-baseline gap-2">
              <span className="text-[clamp(2.1rem,2.6vw,2.6rem)] leading-none font-bold tracking-[-0.03em] text-ink tabular-nums">{c.value}</span>
              <span className="text-[0.875rem] font-medium text-ink-muted">{c.unit}</span>
            </p>
            {c.meter !== undefined && (
              <span aria-hidden="true" className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-(--studio-sunken)">
                <span className="block h-full rounded-full bg-(--st-solid)" style={{ width: `${Math.round(c.meter * 100)}%` }} />
              </span>
            )}
            <p className={cx('relative mt-2 mb-3 text-[0.9375rem] leading-snug font-medium', c.alert || ('tone' in c.tone && c.tone.tone === 'attention') ? 'text-(--st-fg)' : 'text-ink-soft')}>
              {c.alert && <span className="sr-only">Attention: </span>}
              {c.note}
            </p>
            {c.foot && (
              <p className="relative mt-auto flex items-start gap-1.5 border-t border-rule pt-2.5 text-[0.8125rem] leading-snug text-ink-muted">
                {c.foot.dir && <DashIcon name={c.foot.dir} className="mt-px size-3.5 shrink-0 text-ink-soft" />}
                <span>{c.foot.text}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
