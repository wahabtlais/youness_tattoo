import { Link } from 'react-router';
import { countTicks, upcoming, workload } from '../analytics';
import { BarChart } from '../charts/BarChart';
import { DashIcon } from '../DashIcon';
import { clock, dayName, fullDate, plural, shortDate, shortWeekday } from '../format';
import { STUDIO_ROOT } from '../navigation';
import type { AppointmentKind, Overview } from '../types';
import { button } from '../ui';
import { Panel } from './Panel';

const KIND: Record<AppointmentKind, string> = { session: 'Session', consultation: 'Consultation', aftercare: 'Aftercare' };
/** how many appointments the panel lists; the rest are in the calendar */
const LIST = 3;

/**
 * The studio's next seven days, in the booking teal: three figures (hours
 * booked, appointments, the next one) as tiles; the hours booked per day -
 * the y-axis in hours, a free day drawn as a stub and named "Free", each
 * day's appointment count in its own row as a chip, so hours and
 * appointments never read as one measure; then the next three appointments
 * - time, client, kind, what it is, confirmed or not - and the way to the
 * calendar for the rest.
 */
export function WorkloadPanel({ o, now, className }: { o: Overview; now: Date; className?: string }) {
  const days = workload(o, now);
  const all = upcoming(o, now, Infinity);
  const next = all.slice(0, LIST);
  const hours = Math.round(days.reduce((h, d) => h + d.hours, 0) * 10) / 10;
  const count = days.reduce((n, d) => n + d.appointments.length, 0);
  // today's finished ones still count towards the week, but aren't upcoming (the KPI card counts what's ahead)
  const done = days.reduce((n, d) => n + d.appointments.filter((x) => new Date(x.endsAt) < now).length, 0);
  const free = days.filter((d) => d.appointments.length === 0).length;

  return (
    <Panel
      id="studioWorkload"
      title="Studio workload"
      icon="calendar"
      status="booking"
      context={`Next 7 days · ${shortDate(days[0].date)} – ${shortDate(days[6].date)}`}
      link={{ to: `${STUDIO_ROOT}/calendar`, label: 'Calendar' }}
      className={className}
    >
      <div data-status="booking" className="flex min-h-0 flex-1 flex-col">
        <dl className="mb-4 grid grid-cols-2 gap-2 @min-[36rem]:grid-cols-4">
          <Tile label="Hours booked" value={`${hours}`} unit="h" strong />
          <Tile label="Appointments" value={String(count)} unit={done > 0 ? `· ${done} done` : ''} />
          <Tile label="Free days" value={String(free)} unit="of 7" />
          <div className="min-w-0 rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2.5">
            <dt className="text-[0.8125rem] font-medium text-ink-muted">Next</dt>
            <dd className="mt-1 truncate text-[0.9375rem] leading-tight font-semibold text-ink" title={next[0] ? `${fullDate(next[0].startsAt)} · ${next[0].clientName}` : undefined}>
              {next[0] ? `${dayName(now, next[0].startsAt)}, ${clock(next[0].startsAt)}` : 'Nothing booked'}
            </dd>
          </div>
        </dl>

        {hours === 0 ? (
          <div className="grid min-h-40 place-items-center rounded-(--studio-r-md) border border-dashed border-(--studio-line-strong) text-center">
            <p className="text-body text-ink-soft">Nothing booked in the next 7 days.</p>
          </div>
        ) : (
          // the chart takes whatever height the row leaves it (at least 150px)
          <div className="flex min-h-0 flex-1 flex-col">
            <BarChart
              fill
              unitLabel="Hours booked per day"
              noteLabel="Appts"
              label="Hours booked per day, next 7 days"
              yTicks={countTicks(Math.max(...days.map((d) => d.hours)))}
              yFormat={(t) => `${t} h`}
              height={150}
              color="color-mix(in oklab, var(--st-solid) 55%, var(--studio-panel))"
              currentColor="var(--st-solid)"
              columns={days.map((d, i) => ({
                key: d.date.toISOString(),
                tick: i === 0 ? 'Today' : shortWeekday(d.date),
                sub: String(d.date.getDate()),
                note: String(d.appointments.length),
                name: dayName(now, d.date.toISOString()),
                value: d.hours,
                display: d.hours ? `${d.hours} h` : 'Free',
                long: d.appointments.length ? `${d.hours} h booked · ${plural(d.appointments.length, 'appointment')}` : 'Free - nothing booked',
                current: i === 0,
                detail: d.appointments.length ? (
                  <ul>
                    {(Object.keys(d.byKind) as AppointmentKind[])
                      .filter((k) => d.byKind[k])
                      .map((k) => (
                        <li key={k}>{plural(d.byKind[k], KIND[k].toLowerCase())}</li>
                      ))}
                  </ul>
                ) : undefined,
              }))}
            />
          </div>
        )}

        <div className="mt-5 border-t border-rule pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[0.9375rem] font-semibold text-ink">Up next</h3>
            <Link to={`${STUDIO_ROOT}/calendar`} className={button('ghost', 'sm', 'group -mr-2 gap-1.5 text-burgundy hover:text-burgundy-deep')}>
              {all.length > LIST ? `View calendar · ${all.length - LIST} more` : 'View calendar'}
              <DashIcon name="arrow" className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>
          {next.length === 0 ? (
            <p className="py-4 text-body text-ink-soft">No appointments coming up.</p>
          ) : (
            <ol className="grid gap-2">
              {next.map((a) => (
                <li key={a.id} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-3 rounded-(--studio-r-md) border border-rule bg-(--studio-panel) p-2 @min-[34rem]:grid-cols-[4.75rem_minmax(0,1fr)_auto]">
                  <time dateTime={a.startsAt} title={fullDate(a.startsAt)} className="grid h-full place-content-center rounded-(--studio-r-sm) bg-(--st-bg) px-1 py-1.5 text-center">
                    <span className="text-[0.9375rem] leading-tight font-bold text-(--st-fg) tabular-nums">{clock(a.startsAt)}</span>
                    <span className="mt-0.5 text-[0.75rem] leading-tight font-medium text-(--st-fg)">{dayName(now, a.startsAt)}</span>
                  </time>
                  <p className="min-w-0 py-0.5 leading-snug">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[0.9375rem] font-semibold text-ink">{a.clientName}</span>
                      <span className="rounded-full bg-(--studio-sunken) px-2 py-px text-[0.75rem] font-medium text-ink-soft">{KIND[a.kind]}</span>
                    </span>
                    <span className="block truncate text-[0.875rem] text-ink-soft">{a.title}</span>
                  </p>
                  <span
                    data-tone={a.status === 'confirmed' ? 'success' : 'attention'}
                    className="col-start-2 inline-flex h-6 w-fit items-center gap-1 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold whitespace-nowrap text-(--st-fg) @min-[34rem]:col-start-3"
                  >
                    <DashIcon name={a.status === 'confirmed' ? 'check' : 'clock'} className="size-3.5" />
                    {a.status === 'confirmed' ? 'Confirmed' : 'To confirm'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Tile({ label, value, unit, strong }: { label: string; value: string; unit?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-muted">
        {strong && <span aria-hidden="true" className="size-2 rounded-[3px] bg-(--st-solid)" />}
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="text-[1.35rem] leading-none font-bold text-ink tabular-nums">{value}</span>
        {unit && <span className="text-[0.8125rem] text-ink-muted">{' '}{unit}</span>}
      </dd>
    </div>
  );
}
