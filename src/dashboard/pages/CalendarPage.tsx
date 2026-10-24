import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import { ApptActions, NewAppointment } from '../calendar/Booking';
import { useAppointments } from '../calendar/useAppointments';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { clock, dayName, fullDate, plural } from '../format';
import { clientPath, clientsOf, inquiryPath, localDay } from '../records';
import type { Appointment, AppointmentKind } from '../types';
import { button } from '../ui';
import { useOverview } from '../useOverview';

type View = 'day' | 'week' | 'month';
const KIND: Record<AppointmentKind, string> = { session: 'Session', consultation: 'Consultation', aftercare: 'Aftercare' };
const LOCALE = 'en-US';
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, o);
const weekdayShort = fmt({ weekday: 'short' });
const monthYear = fmt({ month: 'long', year: 'numeric' });
const monthDay = fmt({ month: 'short', day: 'numeric' });
const longDay = fmt({ weekday: 'long', month: 'long', day: 'numeric' });

const parseDay = (s: string | null) => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // weeks start on Monday
const sameDay = (a: Date, b: Date) => localDay(a) === localDay(b);
const hourOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};

/**
 * /studio/calendar - sessions, consultations and aftercare check-ins. Week
 * is the working view (day and month beside it), with the date in the
 * address (?view, ?date) so a link can open a given day. Every appointment
 * shows its time, client, kind and whether it's confirmed or still to
 * confirm (green with a check, or amber, dashed, with a clock). Choosing
 * one opens it beside the calendar, with the way to its client and their
 * inquiry, and the way to confirm, mark done or cancel it. New appointments
 * are booked here; the database refuses any overlap with another proposed
 * or confirmed one. Nobody is told automatically.
 */
export function CalendarPage() {
  const [now] = useState(() => new Date());
  const overview = useOverview(now);
  const [params, setParams] = useSearchParams();
  const view: View = (['day', 'week', 'month'] as const).find((v) => v === params.get('view')) ?? 'week';
  const date = parseDay(params.get('date')) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [openId, setOpenId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  useDocumentTitle('Calendar');

  // what's visible: the month's grid (six weeks around it), or the week
  const range = useMemo(() => {
    const first = view === 'month' ? startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1)) : startOfWeek(date);
    return { from: first, to: addDays(first, view === 'month' ? 42 : 7) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, localDay(date)]);
  const live = useAppointments(range.from, range.to);
  const appts = useMemo(() => [...(live.list ?? [])].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1)), [live.list]);
  if (overview.status !== 'success') return <StateMessage kind={overview.status === 'loading' ? 'loading' : 'error'} title="The calendar couldn’t be loaded." />;
  if (live.error && !live.list) return <StateMessage kind="error" title="The calendar couldn’t be loaded." />;

  const clients = clientsOf(overview.data);
  const go = (next: { view?: View; date?: Date }) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set('view', next.view ?? view);
        n.set('date', localDay(next.date ?? date));
        return n;
      },
      { replace: true },
    );
  const step = (dir: -1 | 1) => go({ date: view === 'day' ? addDays(date, dir) : view === 'week' ? addDays(date, 7 * dir) : new Date(date.getFullYear(), date.getMonth() + dir, 1) });
  const on = (d: Date) => appts.filter((a) => sameDay(new Date(a.startsAt), d));
  const open = appts.find((a) => a.id === openId) ?? null;
  // what's ahead comes from the overview (every proposed or confirmed appointment from now on)
  const ahead = overview.data.appointments.filter((a) => a.status === 'proposed' || a.status === 'confirmed');

  const weekStart = startOfWeek(date);
  const title =
    view === 'day' ? longDay.format(date) : view === 'week' ? `${monthDay.format(weekStart)} – ${monthDay.format(addDays(weekStart, 6))}` : monthYear.format(date);
  const upcoming = ahead.filter((a) => new Date(a.endsAt) >= now).slice(0, 12);
  const toConfirm = upcoming.filter((a) => a.status === 'proposed').length;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Calendar"
        summary={`${plural(ahead.filter((a) => new Date(a.endsAt) >= now).length, 'appointment')} ahead · ${toConfirm} to confirm`}
        actions={
          <button type="button" onClick={() => setBooking(true)} className={button('primary')}>
            <DashIcon name="calendar" />
            New appointment
          </button>
        }
      />

      {/* the controls: where you are in time, and how much of it you see */}
      <div className="studio-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`} className={button('secondary', 'md', 'px-2.5')}>
              <DashIcon name="arrow" className="rotate-180" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={`Next ${view}`} className={button('secondary', 'md', 'px-2.5')}>
              <DashIcon name="arrow" />
            </button>
          </div>
          <button type="button" onClick={() => go({ date: now })} className={button('secondary')}>
            Today
          </button>
          <h2 aria-live="polite" className="ml-1 type-heading text-[1.15rem]">
            {title}
          </h2>
        </div>
        <Segmented
          label="Calendar view"
          value={view}
          onChange={(v) => go({ view: v })}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>

      <div className="grid items-start gap-5 @min-[66rem]:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-label={`${view === 'month' ? 'Month' : view === 'week' ? 'Week' : 'Day'}: ${title}`} className="studio-card min-w-0 overflow-hidden">
          {view === 'month' ? (
            <Month date={date} now={now} on={on} onPick={(d) => go({ view: 'day', date: d })} />
          ) : (
            <Timeline days={view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))} now={now} on={on} openId={openId} onOpen={setOpenId} />
          )}
          <Legend />
        </section>

        <aside aria-label="Appointment and what’s next" className="grid content-start gap-5">
          {booking && (
            <NewAppointment
              clients={clients}
              day={date}
              onCancel={() => setBooking(false)}
              onDone={(startsAt) => {
                setBooking(false);
                void live.reload();
                go({ date: new Date(startsAt) });
              }}
            />
          )}
          {open ? (
            <ApptPanel
              a={open}
              now={now}
              inquiryTo={(() => {
                const q = open.inquiryId ? overview.data.inquiries.find((x) => x.id === open.inquiryId) : clients.find((c) => c.id === open.clientId || c.name === open.clientName)?.inquiries[0];
                return q ? inquiryPath(q) : undefined;
              })()}
              onClose={() => setOpenId(null)}
              onChanged={() => void live.reload()}
            />
          ) : null}
          <section aria-labelledby="calUpNext" className="studio-card p-4">
            <h2 id="calUpNext" className="type-heading text-[1.05rem]">
              Up next
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-[0.9375rem] text-ink-soft">Nothing booked ahead.</p>
            ) : (
              <ol className="mt-3 grid gap-2">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(a.id);
                        go({ date: new Date(a.startsAt) });
                      }}
                      aria-pressed={openId === a.id}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-(--studio-r-md) border border-rule p-2.5 text-left transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover) focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid aria-pressed:border-burgundy aria-pressed:bg-(--studio-selected)"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.75rem] font-semibold text-ink-muted">
                          {dayName(now, a.startsAt)} · {clock(a.startsAt)}
                        </span>
                        <span className="block truncate text-[0.875rem] font-semibold text-ink">{a.clientName}</span>
                        <span className="block truncate text-[0.8125rem] text-ink-soft">{KIND[a.kind]}</span>
                      </span>
                      <StatusMark a={a} compact />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** confirmed (check, green) or still to confirm (clock, amber) - always a word or an icon with a name */
function StatusMark({ a, compact }: { a: Appointment; compact?: boolean }) {
  const ok = a.status === 'confirmed';
  return (
    <span
      data-tone={ok ? 'success' : 'attention'}
      title={ok ? 'Confirmed' : 'To confirm'}
      className={cx('inline-flex h-6 items-center gap-1 rounded-full bg-(--st-bg) text-[0.75rem] font-semibold whitespace-nowrap text-(--st-fg)', compact ? 'px-1.5' : 'px-2')}
    >
      <DashIcon name={ok ? 'check' : 'clock'} className="size-3.5" />
      <span className={compact ? 'sr-only' : undefined}>{ok ? 'Confirmed' : 'To confirm'}</span>
    </span>
  );
}

function Legend() {
  return (
    <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 text-[0.8125rem] font-medium text-ink-muted">
      <li data-tone="success" className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] border border-(--st-line) bg-(--st-bg)" />
        Confirmed
      </li>
      <li data-tone="attention" className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-4 rounded-[3px] border border-dashed border-(--st-solid) bg-(--st-bg)" />
        To confirm
      </li>
    </ul>
  );
}

const DAY_START = 9;
const DAY_END = 20;
const HOUR_PX = 52;

/** a day or a week as columns of time, 9:00 to 20:00 - an agenda list instead where the space is narrow */
function Timeline({ days, now, on, openId, onOpen }: { days: Date[]; now: Date; on: (d: Date) => Appointment[]; openId: string | null; onOpen: (id: string) => void }) {
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // the sample calendar covers today and the next six days: only there is an empty day "free"
  const covered = (d: Date) => d >= today0 && d < addDays(today0, 7);
  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
  const any = days.some((d) => on(d).length > 0);
  const single = days.length === 1;
  return (
    <div className="@container">
      {!any && (
        <p className="border-b border-rule bg-(--studio-sunken) px-4 py-2.5 text-[0.875rem] text-ink-soft">
          No appointments {single ? 'on this day' : 'this week'}. The sample calendar covers today and the next 6 days.
        </p>
      )}
      {/* wide: the grid of time */}
      <div className={cx(single ? '' : 'hidden @min-[44rem]:block')}>
        <div className="grid border-b border-rule" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <span />
          {days.map((d) => {
            const today = sameDay(d, now);
            const free = on(d).length === 0 && covered(d);
            return (
              <div key={d.toISOString()} className={cx('border-l border-rule px-2 py-2 text-center', today && 'bg-(--studio-selected)')}>
                <p className={cx('text-[0.75rem] font-semibold', today ? 'text-burgundy' : 'text-ink-muted')}>{weekdayShort.format(d)}</p>
                <p className={cx('text-[1.15rem] leading-tight font-bold tabular-nums', today ? 'text-burgundy' : 'text-ink')}>{d.getDate()}</p>
                <p className="text-[0.6875rem] font-medium text-ink-muted">{today ? (on(d).length ? `Today · ${plural(on(d).length, 'appt')}` : 'Today · free') : free ? 'Free' : on(d).length ? plural(on(d).length, 'appt') : d < today0 ? 'Past' : '—'}</p>
              </div>
            );
          })}
        </div>
        <div className="relative grid max-h-[38rem] overflow-y-auto pt-2" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div aria-hidden="true">
            {hours.slice(0, -1).map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[0.75rem] text-ink-muted tabular-nums">
                <span className="relative -top-2">{h}:00</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const today = sameDay(d, now);
            const list = on(d);
            return (
              <div key={d.toISOString()} className={cx('relative border-l border-rule', today && 'bg-(--studio-selected)/50', list.length === 0 && covered(d) && 'bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--studio-grid)_10px_11px)]', !covered(d) && !today && 'bg-(--studio-sunken)/60')}>
                {hours.slice(0, -1).map((h) => (
                  <div key={h} style={{ height: HOUR_PX }} className="border-t border-(--studio-grid)" />
                ))}
                {today && hourOf(now.toISOString()) >= DAY_START && hourOf(now.toISOString()) <= DAY_END && (
                  <span aria-hidden="true" className="absolute inset-x-0 z-10 h-0.5 bg-(--studio-brand)" style={{ top: (hourOf(now.toISOString()) - DAY_START) * HOUR_PX }}>
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-(--studio-brand)" />
                  </span>
                )}
                {list.map((a) => {
                  const top = (Math.max(DAY_START, hourOf(a.startsAt)) - DAY_START) * HOUR_PX;
                  const height = Math.max(24, (Math.min(DAY_END, hourOf(a.endsAt)) - Math.max(DAY_START, hourOf(a.startsAt))) * HOUR_PX - 3);
                  const short = height < 46;
                  const ok = a.status === 'confirmed';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpen(a.id)}
                      aria-pressed={openId === a.id}
                      aria-label={`${clock(a.startsAt)}–${clock(a.endsAt)}, ${a.clientName}, ${KIND[a.kind]}: ${a.title}. ${ok ? 'Confirmed' : 'To confirm'}`}
                      data-tone={ok ? 'success' : 'attention'}
                      style={{ top: top + 1, height }}
                      className={cx(
                        'absolute inset-x-1 z-[5] flex flex-col justify-start overflow-hidden rounded-(--studio-r-sm) border bg-(--st-bg) px-2 text-left transition-shadow',
                        short ? 'py-0.5' : 'py-1',
                        'hover:z-[6] hover:shadow-(--studio-shadow-lift) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus focus-visible:outline-solid',
                        ok ? 'border-(--st-line) border-l-[3px] border-l-(--st-solid)' : 'border-dashed border-(--st-solid)',
                        openId === a.id && 'ring-2 ring-burgundy',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1 text-[0.6875rem] font-bold whitespace-nowrap text-(--st-fg) tabular-nums">
                        <DashIcon name={ok ? 'check' : 'clock'} className="size-3 shrink-0" />
                        {clock(a.startsAt)}
                        {short && <span className="truncate font-semibold text-ink">{a.clientName.replace('Sample client ', 'Client ')}</span>}
                      </span>
                      {!short && <span className="line-clamp-2 text-[0.8125rem] leading-tight font-semibold break-words text-ink">{a.clientName}</span>}
                      {height > 60 && <span className="block truncate text-[0.75rem] leading-tight text-ink-soft">{KIND[a.kind]}</span>}
                      {height > 90 && <span className="mt-0.5 line-clamp-2 text-[0.75rem] leading-tight text-ink-muted">{a.title}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* narrow: the week as an agenda */}
      {!single && (
        <ol className="divide-y divide-rule @min-[44rem]:hidden">
          {days.map((d) => (
            <li key={d.toISOString()} className={cx('grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-3 py-3', sameDay(d, now) && 'bg-(--studio-selected)')}>
              <span className="text-center">
                <span className="block text-[0.75rem] font-semibold text-ink-muted">{weekdayShort.format(d)}</span>
                <span className="block text-[1.15rem] font-bold text-ink tabular-nums">{d.getDate()}</span>
              </span>
              {on(d).length === 0 ? (
                <span className="self-center text-[0.875rem] text-ink-muted">{covered(d) ? 'Free' : d < today0 ? 'Past - outside the sample calendar' : 'Outside the sample calendar'}</span>
              ) : (
                <span className="grid gap-1.5">
                  {on(d).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpen(a.id)}
                      data-tone={a.status === 'confirmed' ? 'success' : 'attention'}
                      className={cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-(--studio-r-sm) border bg-(--st-bg) px-2.5 py-1.5 text-left', a.status === 'confirmed' ? 'border-(--st-line)' : 'border-dashed border-(--st-solid)')}
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.75rem] font-bold text-(--st-fg)">
                          {clock(a.startsAt)}–{clock(a.endsAt)}
                        </span>
                        <span className="block truncate text-[0.875rem] font-semibold text-ink">
                          {a.clientName} · {KIND[a.kind]}
                        </span>
                      </span>
                      <StatusMark a={a} compact />
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** a month: each day with its appointments as small marks, today ringed; a day opens in the day view */
function Month({ date, now, on, onPick }: { date: Date; now: Date; on: (d: Date) => Appointment[]; onPick: (d: Date) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-rule">
        {days.slice(0, 7).map((d) => (
          <span key={d.toISOString()} className="px-2 py-2 text-center text-[0.75rem] font-semibold text-ink-muted">
            {weekdayShort.format(d)}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((d) => {
          const list = on(d);
          const inMonth = d.getMonth() === date.getMonth();
          const today = sameDay(d, now);
          return (
            <li key={d.toISOString()} className="border-r border-b border-rule [&:nth-child(7n)]:border-r-0">
              <button
                type="button"
                onClick={() => onPick(d)}
                aria-label={`${longDay.format(d)}: ${list.length ? plural(list.length, 'appointment') : 'nothing booked'}`}
                className={cx('flex h-full min-h-20 w-full flex-col gap-1 p-1.5 text-left transition-colors hover:bg-(--studio-hover) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid @min-[44rem]:min-h-24', !inMonth && 'opacity-45')}
              >
                <span className={cx('grid size-7 place-items-center rounded-full text-[0.8125rem] font-semibold tabular-nums', today ? 'bg-(--studio-brand) text-(--studio-on-brand)' : 'text-ink')}>{d.getDate()}</span>
                {list.slice(0, 3).map((a) => (
                  <span
                    key={a.id}
                    data-tone={a.status === 'confirmed' ? 'success' : 'attention'}
                    className={cx('hidden truncate rounded-[4px] border px-1 text-[0.6875rem] font-semibold text-(--st-fg) @min-[44rem]:block', a.status === 'confirmed' ? 'border-transparent bg-(--st-bg)' : 'border-dashed border-(--st-solid) bg-(--st-bg)')}
                  >
                    {clock(a.startsAt)} {a.clientName.replace('Sample client ', '')}
                  </span>
                ))}
                {list.length > 0 && (
                  <span className="flex gap-0.5 @min-[44rem]:hidden" aria-hidden="true">
                    {list.map((a) => (
                      <span key={a.id} data-tone={a.status === 'confirmed' ? 'success' : 'attention'} className="size-1.5 rounded-full bg-(--st-solid)" />
                    ))}
                  </span>
                )}
                {list.length > 3 && <span className="hidden text-[0.6875rem] text-ink-muted @min-[44rem]:block">+{list.length - 3} more</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ApptPanel({ a, now, inquiryTo, onClose, onChanged }: { a: Appointment; now: Date; inquiryTo?: string; onClose: () => void; onChanged: () => void }) {
  return (
    <section aria-labelledby="apptTitle" className="studio-card relative overflow-hidden p-4" data-tone={a.status === 'confirmed' ? 'success' : 'attention'}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-(--st-solid)" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink-muted">
            {KIND[a.kind]}
            {a.demo ? ' · Sample' : ''}
          </p>
          <h2 id="apptTitle" className="type-heading text-[1.1rem] leading-snug">
            {a.title}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the appointment" className={button('ghost', 'sm', 'px-2')}>
          <DashIcon name="close" />
        </button>
      </div>
      <dl className="mt-3 grid gap-2 text-[0.875rem]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">When</dt>
          <dd className="text-right font-medium text-ink" title={fullDate(a.startsAt)}>
            {dayName(now, a.startsAt)}, {clock(a.startsAt)}–{clock(a.endsAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Status</dt>
          <dd>
            <StatusMark a={a} />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Client</dt>
          <dd>
            <Link to={clientPath(a)} className="font-semibold text-burgundy hover:underline">
              {a.clientName}
            </Link>
          </dd>
        </div>
      </dl>
      {a.prep && (
        <p data-tone="info" className="mt-3 flex items-start gap-2 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-ink">
          <DashIcon name="prepare" className="mt-0.5 size-4 shrink-0 text-(--st-fg)" />
          <span>
            <span className="font-semibold text-(--st-fg)">To prepare: </span>
            {a.prep}
          </span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={clientPath(a)} className={button('secondary', 'sm')}>
          Client record
        </Link>
        {inquiryTo && (
          <Link to={inquiryTo} className={button('secondary', 'sm')}>
            Their inquiry
          </Link>
        )}
      </div>
      <ApptActions a={a} now={now} onChanged={onChanged} />
    </section>
  );
}
