import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { StateMessage } from '../../components/ui/StateMessage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ago, clock, dayName, daysFrom, fullDate, plural } from '../format';
import { SearchField } from '../inquiries/SearchField';
import { StatusBadge } from '../inquiries/StatusBadge';
import { placementLine } from '../inquiries/inquiryText';
import { STUDIO_ROOT } from '../navigation';
import { calendarPath, clientsOf, inquiryPath, RELATIONSHIP, type ClientRecord, type Relationship } from '../records';
import { ClientHistoryCard, ClientNotesCard, ContactCard, FollowUpsCard } from '../clients/ClientPanels';
import { useClientDetail } from '../clients/useClientDetail';
import { useOverview } from '../useOverview';

const ROOT = `${STUDIO_ROOT}/clients`;
const KIND = { session: 'Session', consultation: 'Consultation', aftercare: 'Aftercare' } as const;

/**
 * /studio/clients - the people behind the work, and /studio/clients/:id -
 * one of them. A searchable list (by relationship: new inquiry, in
 * conversation, booked, tattooed, declined), and the chosen client's
 * record beside it: their ideas (inquiries), appointments, contact
 * details, what's owed them, private notes and history - all saved.
 * Sample (demo) clients have no contact details and are labelled.
 */
export function ClientsPage() {
  const [now] = useState(() => new Date());
  const overview = useOverview(now);
  const { clientId } = useParams();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Relationship | 'all'>('all');
  const clients = useMemo(() => (overview.status === 'success' ? clientsOf(overview.data) : []), [overview]);
  const selected = clients.find((c) => c.id === clientId);
  useDocumentTitle(selected ? `${selected.name} · Clients` : 'Clients');

  if (overview.status !== 'success') return <StateMessage kind={overview.status === 'loading' ? 'loading' : 'error'} title="The clients couldn’t be loaded." />;

  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = clients.filter(
    (c) => (filter === 'all' || c.relationship === filter) && words.every((w) => `${c.name} ${c.inquiries.map((q) => q.summary.concept ?? '').join(' ')}`.toLowerCase().includes(w)),
  );
  const count = (r: Relationship) => clients.filter((c) => c.relationship === r).length;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Clients"
        trail={selected ? [{ label: 'Clients', to: ROOT }, { label: selected.name }] : undefined}
        summary={`${clients.length} people from the last 12 weeks of inquiries and the calendar · ${count('booked')} booked · ${count('inquiry')} waiting on an answer`}
      />

      <div className="grid items-start gap-5 @min-[60rem]:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        {/* the list - on a narrow screen, hidden while a client is open */}
        <section aria-label="All clients" className={cx('studio-card flex min-w-0 flex-col overflow-hidden', selected && '@max-[60rem]:hidden')}>
          <div className="grid gap-3 border-b border-rule p-4">
            <SearchField value={text} onChange={setText} label="Search clients" placeholder="Search by name or idea…" />
            <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
              {(['all', 'inquiry', 'talking', 'booked', 'tattooed', 'declined'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={filter === r}
                  onClick={() => setFilter(r)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-(--studio-line-strong) px-3 text-[0.8125rem] font-semibold text-ink-soft transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid aria-pressed:border-burgundy aria-pressed:bg-(--studio-selected) aria-pressed:text-ink"
                >
                  {r === 'all' ? 'Everyone' : RELATIONSHIP[r].label}
                  <span className="text-ink-muted tabular-nums">{r === 'all' ? clients.length : count(r)}</span>
                </button>
              ))}
            </div>
            <p aria-live="polite" className="text-[0.8125rem] font-medium text-ink-muted">
              {shown.length === clients.length ? plural(clients.length, 'client') : `${shown.length} of ${clients.length}`}
            </p>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon="clients" title="No one matches." className="m-4">
              Try another name or idea, or show everyone.
            </EmptyState>
          ) : (
            <ul aria-label="Clients" className="max-h-[calc(100svh-22rem)] min-h-64 divide-y divide-rule overflow-y-auto">
              {shown.map((c) => (
                <li key={c.id}>
                  <ClientRow c={c} now={now} current={c.id === selected?.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <ClientRecordView c={selected} now={now} />
        ) : clientId ? (
          <EmptyState icon="clients" title="There’s no client at this address." action={<Link to={ROOT} className="font-semibold text-burgundy hover:underline">Back to all clients</Link>}>
            It may have been a sample that no longer exists.
          </EmptyState>
        ) : (
          <EmptyState icon="clients" title="Choose a client" className="min-h-80 @max-[60rem]:hidden">
            Their ideas, appointments and anything you owe them appear here.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

const initials = (name: string) => name.replace('Sample client ', '').slice(0, 2);

function Avatar({ c, size = 'md' }: { c: ClientRecord; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      data-tone={RELATIONSHIP[c.relationship].tone}
      className={cx('grid shrink-0 place-items-center rounded-full bg-(--st-bg) font-bold text-(--st-fg)', size === 'lg' ? 'size-14 text-[1.15rem]' : 'size-10 text-[0.875rem]')}
    >
      {initials(c.name)}
    </span>
  );
}

function RelationPill({ r }: { r: Relationship }) {
  return (
    <span data-tone={RELATIONSHIP[r].tone} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold whitespace-nowrap text-(--st-fg)">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
      {RELATIONSHIP[r].label}
    </span>
  );
}

function ClientRow({ c, now, current }: { c: ClientRecord; now: Date; current: boolean }) {
  const next = c.appointments.find((a) => new Date(a.endsAt) >= now);
  const overdue = c.followUps.some((f) => daysFrom(now, f.dueAt) < 0);
  return (
    <Link
      to={`${ROOT}/${c.id}`}
      aria-current={current ? 'page' : undefined}
      className={cx('group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors hover:bg-(--studio-hover)', current && 'bg-(--studio-selected) hover:bg-(--studio-selected)')}
    >
      {current && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-burgundy" />}
      <Avatar c={c} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.9375rem] font-semibold text-ink">{c.name}</span>
          <RelationPill r={c.relationship} />
        </span>
        <span className="block truncate text-[0.875rem] text-ink-soft">{c.inquiries[0]?.summary.concept ?? (c.appointments[0]?.title || 'No idea recorded')}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.75rem] font-medium text-ink-muted">
          {next && (
            <span className="inline-flex items-center gap-1" data-status="booking">
              <DashIcon name="calendar" className="size-3.5 text-(--st-fg)" />
              {dayName(now, next.startsAt)}, {clock(next.startsAt)}
            </span>
          )}
          {overdue && (
            <span data-tone="danger" className="inline-flex items-center gap-1 font-semibold text-(--st-fg)">
              <DashIcon name="alert" className="size-3.5" />
              Follow-up overdue
            </span>
          )}
          {!next && !overdue && <span>Last heard {ago(now, c.inquiries[0]?.receivedAt ?? c.lastAt)}</span>}
        </span>
      </span>
    </Link>
  );
}

function ClientRecordView({ c, now }: { c: ClientRecord; now: Date }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [c.id]);
  const upcoming = c.appointments.filter((a) => new Date(a.endsAt) >= now);
  const past = c.appointments.filter((a) => new Date(a.endsAt) < now);
  const detail = useClientDetail(c.id);

  return (
    <article aria-labelledby="clientName" className="grid min-w-0 gap-5">
      <Link to={ROOT} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-raised) px-3 text-[0.8125rem] font-semibold text-ink @min-[60rem]:hidden">
        <DashIcon name="arrow" className="size-3.5 rotate-180" />
        All clients
      </Link>
      <header className="studio-card flex flex-wrap items-center gap-4 p-5">
        <Avatar c={c} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="clientName" ref={heading} tabIndex={-1} className="studio-title text-[clamp(1.6rem,2.2vw,2rem)] leading-tight outline-none">
            {c.name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-ink-muted">
            <RelationPill r={c.relationship} />
            <span>{RELATIONSHIP[c.relationship].hint}</span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Ideas', c.inquiries.length],
            ['Upcoming', upcoming.length],
            ['Owed', c.followUps.length],
          ].map(([k, v]) => (
            <div key={k} className="min-w-18 rounded-(--studio-r-md) bg-(--studio-sunken) px-3 py-2">
              <dt className="text-[0.75rem] font-medium text-ink-muted">{k}</dt>
              <dd className="text-[1.25rem] leading-tight font-bold text-ink tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid items-start gap-5 @min-[84rem]:grid-cols-2">
        <section aria-labelledby="clientIdeas" className="studio-card p-5">
          <h3 id="clientIdeas" className="type-heading text-[1.05rem]">
            Tattoo ideas
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Their inquiries from the website</p>
          {c.inquiries.length === 0 ? (
            <p className="mt-3 text-[0.9375rem] text-ink-soft">No inquiry on record — they appear here through the calendar or a follow-up.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {c.inquiries.map((q) => (
                <li key={q.id}>
                  <Link to={inquiryPath(q)} className="group block rounded-(--studio-r-md) border border-rule p-3 transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={q.status} size="sm" />
                      <span className="text-[0.75rem] text-ink-muted" title={fullDate(q.receivedAt)}>
                        Received {ago(now, q.receivedAt)}
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[0.9375rem] font-semibold text-ink group-hover:text-burgundy">{q.summary.concept ?? 'No idea described'}</span>
                    <span className="block text-[0.8125rem] text-ink-muted">{placementLine(q.summary) || 'No placement given'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-5">
          <section aria-labelledby="clientAppts" className="studio-card p-5" data-status="booking">
            <h3 id="clientAppts" className="type-heading text-[1.05rem]">
              Appointments
            </h3>
            <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Proposed and confirmed - upcoming, and the last two months</p>
            {c.appointments.length === 0 ? (
              <p className="mt-3 text-[0.9375rem] text-ink-soft">Nothing on the calendar.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {[...upcoming, ...past].map((a) => (
                  <li key={a.id}>
                    <Link to={calendarPath(a.startsAt)} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-(--studio-r-md) border border-rule p-2 transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                      <span className="grid place-content-center rounded-(--studio-r-sm) bg-(--st-bg) py-1.5 text-center">
                        <span className="text-[0.875rem] font-bold text-(--st-fg) tabular-nums">{clock(a.startsAt)}</span>
                        <span className="text-[0.6875rem] font-medium text-(--st-fg)">{dayName(now, a.startsAt)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-semibold text-ink">
                          {KIND[a.kind]} · {a.title}
                        </span>
                        <span data-tone={a.status === 'confirmed' ? 'success' : 'attention'} className="mt-0.5 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-(--st-fg)">
                          <DashIcon name={a.status === 'confirmed' ? 'check' : 'clock'} className="size-3.5" />
                          {a.status === 'confirmed' ? 'Confirmed' : 'To confirm'}
                          {new Date(a.endsAt) < now && <span className="text-ink-muted"> · earlier today</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.data ? (
            <>
              <ContactCard key={detail.data.id + detail.data.name} c={detail.data} onSaved={() => void detail.reload()} />
              <FollowUpsCard c={detail.data} now={now} onChanged={() => void detail.reload()} />
              <ClientNotesCard c={detail.data} onChanged={() => void detail.reload()} />
              <ClientHistoryCard c={detail.data} now={now} />
            </>
          ) : (
            <p role="status" className="studio-card p-5 text-[0.9375rem] text-ink-muted">
              {detail.error ?? 'Loading their record…'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
