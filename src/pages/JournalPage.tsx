import { Link, useSearchParams } from 'react-router';
import { ContentPicture } from '../components/content/ContentParts';
import { ButtonLink } from '../components/ui/ButtonLink';
import { DemoNotice } from '../components/ui/DemoNotice';
import { StateMessage } from '../components/ui/StateMessage';
import { JOURNAL_KINDS, journalKindLabel, journalWhen, type JournalKind, type JournalPost } from '../domain/journal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useJournal } from '../hooks/useContent';
import { useWork } from '../hooks/useWork';
import { cx } from '../lib/cx';
import { dateParts, formatDate, formatRange, today } from '../lib/date';

/**
 * /journal - set like a magazine. Under the introduction and its category
 * filter (?kind=), one featured story, its photograph beside it; then
 * Upcoming as a calendar, Recent as a lead story with a column of others,
 * and the Archive as a quiet index. The filter narrows everything; a band
 * with nothing in it isn't drawn.
 *
 * The feature is chosen from the data, never by name: the nearest upcoming
 * event with a photograph, else the newest recent story with one, else the
 * first upcoming or recent story, set as text. It leaves its band, so no
 * story shows twice. Archive stories are never featured.
 */
export function JournalPage() {
  useDocumentTitle('Journal');
  const journal = useJournal();
  const work = useWork();
  const [params] = useSearchParams();
  const kind = JOURNAL_KINDS.some((k) => k.value === params.get('kind')) ? (params.get('kind') as JournalKind) : null;

  if (journal.status !== 'success') {
    return <StateMessage kind={journal.status === 'loading' ? 'loading' : 'error'} title="The journal could not be loaded." className="min-h-svh justify-center px-page-x" />;
  }
  const { items, demo } = journal.data;
  const now = today();
  // a picture that will actually show: its own photograph, or a piece that exists
  const pictured = (p: JournalPost) =>
    !!p.image && ('image' in p.image || (work.status === 'success' && work.data.some((w) => 'workId' in p.image! && w.id === p.image.workId)));
  const posts = kind ? items.filter((p) => p.kind === kind) : items;
  const upcomingAll = posts.filter((p) => journalWhen(p, now) === 'upcoming').sort((a, b) => (a.event!.start < b.event!.start ? -1 : 1));
  const recentAll = posts.filter((p) => journalWhen(p, now) === 'recent');
  const archive = posts.filter((p) => journalWhen(p, now) === 'archive');
  const feature = upcomingAll.find(pictured) ?? recentAll.find(pictured) ?? upcomingAll[0] ?? recentAll[0];
  const upcoming = upcomingAll.filter((p) => p !== feature);
  const recent = recentAll.filter((p) => p !== feature);
  // Recent's lead: the newest with a photograph, else simply the newest
  const lead = recent.find(pictured) ?? recent[0];
  const others = recent.filter((p) => p !== lead);
  const kinds = JOURNAL_KINDS.filter((k) => items.some((p) => p.kind === k.value));

  return (
    <>
      <header className="mx-auto max-w-page px-page-x pt-[clamp(7.5rem,18vh,11rem)]">
        <div className="grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-6 pb-[clamp(1.75rem,4.5vh,3rem)] desktop:grid-cols-12 desktop:items-end">
          <div className="desktop:col-span-7">
            <p className="type-eyebrow text-burgundy">/ Journal</p>
            <h1 className="mt-4 font-serif text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">Journal</h1>
          </div>
          <div className="grid gap-4 desktop:col-span-4 desktop:col-start-9 desktop:pb-2">
            <p className="max-w-[40ch] text-body leading-copy text-ink-soft">
              Conventions, guest spots, results and news from the studio — what has happened, and what is coming.
            </p>
            {demo && <DemoNotice id="journalDemo">Demo content — fictional examples. None of these events or results are real.</DemoNotice>}
          </div>
        </div>
        {kinds.length > 1 ? (
          <nav aria-label="Categories" className="border-y border-y-ink/80 border-b-rule">
            <ul className="-mx-3 flex flex-wrap gap-x-1 py-1.5">
              {[{ value: null, label: 'All' }, ...kinds].map((k) => {
                const n = k.value ? items.filter((p) => p.kind === k.value).length : items.length;
                return (
                  <li key={k.label}>
                    <Link
                      to={k.value ? { search: `?kind=${k.value}` } : { search: '' }}
                      replace
                      aria-current={kind === k.value ? 'page' : undefined}
                      className="group relative inline-flex min-h-11 items-center gap-1.5 px-3 type-label text-ink-soft transition-colors hover:text-ink aria-[current=page]:text-burgundy"
                    >
                      {k.label}
                      <span className="type-micro text-ink-muted group-aria-[current=page]:text-burgundy">{String(n).padStart(2, '0')}</span>
                      <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-0.5 scale-x-0 bg-burgundy transition-transform group-aria-[current=page]:scale-x-100 motion-reduce:transition-none" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="border-t border-ink/80" />
        )}
      </header>

      <div className="pb-[clamp(3rem,8vh,5rem)]">
        {items.length === 0 && <StateMessage kind="empty" title="Nothing has been published yet." className="mx-auto max-w-page px-page-x py-16" />}
        {items.length > 0 && posts.length === 0 && (
          <StateMessage
            kind="empty"
            title="Nothing in this category yet."
            detail={
              <Link to={{ search: '' }} className="underline decoration-burgundy underline-offset-4">
                Show everything
              </Link>
            }
            className="mx-auto max-w-page px-page-x py-16"
          />
        )}

        {feature && <Feature post={feature} upcoming={upcomingAll.includes(feature)} pictured={pictured(feature)} />}

        {upcoming.length > 0 && (
          <section aria-labelledby="journalUpcoming" className="mt-[clamp(3rem,9vh,6rem)] bg-paper-deep">
            <div className="mx-auto max-w-page px-page-x py-[clamp(2.5rem,7vh,4.5rem)]">
              <BandTitle id="journalUpcoming" title="Upcoming" count={upcoming.length} note="The calendar, soonest first" />
              <ol>
                {upcoming.map((p) => (
                  <li
                    key={p.slug}
                    className="group/card relative grid gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-3 border-t border-ink/15 py-[clamp(1.5rem,4vh,2.25rem)] first:border-t-0 first:pt-0 tablet:grid-cols-[10rem_minmax(0,1fr)] desktop:grid-cols-[12rem_minmax(0,1fr)_auto] desktop:items-start"
                  >
                    <EventDate post={p} />
                    <div>
                      <Kicker post={p} date={false} />
                      <h3 className="mt-2 max-w-[30ch] font-serif text-title transition-colors group-hover/card:text-burgundy">{p.title}</h3>
                      {p.event && <p className="mt-1.5 type-meta text-ink">{p.event.location}</p>}
                      <p className="mt-3 line-clamp-3 max-w-[60ch] text-body leading-copy text-ink-soft">{p.summary}</p>
                    </div>
                    <ReadLink post={p} className="desktop:self-end" />
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {lead && (
          <section aria-labelledby="journalRecent" className="mx-auto max-w-page px-page-x pt-[clamp(3rem,9vh,6rem)]">
            <BandTitle id="journalRecent" title="Recent" count={recent.length} note="The last twelve months" />
            <div className="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 desktop:grid-cols-12">
              <Lead post={lead} pictured={pictured(lead)} alone={others.length === 0} />
              {others.length > 0 && (
                <div className="border-t border-ink pt-5 desktop:col-span-4 desktop:border-t-0 desktop:border-l desktop:border-rule desktop:pt-0 desktop:pl-[clamp(1.5rem,3vw,3rem)]">
                  <p className="mb-5 type-meta text-ink-muted">Also recent</p>
                  <ul>
                    {others.map((p) => (
                      <li key={p.slug} className="group/card relative border-t border-rule py-6 first:border-t-0 first:pt-0">
                        <Kicker post={p} />
                        <h3 className="mt-2 font-serif text-title transition-colors group-hover/card:text-burgundy">{p.title}</h3>
                        <p className="mt-2.5 line-clamp-3 text-body leading-copy text-ink-soft">{p.summary}</p>
                        <ReadLink post={p} className="mt-2" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {archive.length > 0 && (
          <section aria-labelledby="journalArchive" className="mx-auto max-w-page px-page-x pt-[clamp(3rem,9vh,6rem)]">
            <BandTitle id="journalArchive" title="Archive" count={archive.length} note="Older stories, newest first" quiet />
            <ul>
              {archive.map((p) => (
                <li key={p.slug} className="border-t border-rule first:border-t-0">
                  <Link
                    to={`/journal/${p.slug}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-3.5 transition-colors hover:text-burgundy tablet:grid-cols-[10rem_10rem_minmax(0,1fr)_auto]"
                  >
                    <span className="flex gap-x-4 type-meta text-ink-muted tablet:contents">
                      <time dateTime={p.date}>{formatDate(p.date)}</time>
                      <span className="text-ink-soft">{journalKindLabel(p.kind)}</span>
                    </span>
                    <span className="col-start-1 font-serif text-lede tablet:col-start-3">
                      {p.title}
                      {p.demo && <DemoNotice inline className="ml-3 align-middle whitespace-nowrap" />}
                    </span>
                    <span
                      aria-hidden="true"
                      className="col-start-2 row-span-2 row-start-1 self-center text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-burgundy group-focus-visible:translate-x-1 motion-reduce:transition-none tablet:col-start-4 tablet:row-span-1"
                    >
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/** a band's title: serif, its count and a mono note, over a full ink rule */
function BandTitle({ id, title, count, note, quiet }: { id: string; title: string; count: number; note: string; quiet?: boolean }) {
  return (
    <div className="mb-[clamp(1.5rem,4vh,2.5rem)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-3">
      <h2 id={id} className={cx('flex items-baseline gap-3 font-serif leading-none', quiet ? 'text-title' : 'text-[clamp(1.8rem,3.4vw,2.8rem)]')}>
        {title}
        <span className="type-meta text-ink-muted">{String(count).padStart(2, '0')}</span>
      </h2>
      <p className="type-meta text-ink-soft">{note}</p>
    </div>
  );
}

/** category · date · (fictional) */
function Kicker({ post, date = true, className }: { post: JournalPost; date?: boolean; className?: string }) {
  return (
    <p className={cx('flex flex-wrap gap-x-3 gap-y-1 type-meta text-ink-soft', className)}>
      <span className="text-burgundy">{journalKindLabel(post.kind)}</span>
      {date && <time dateTime={post.date} className="text-ink-muted">{formatDate(post.date)}</time>}
      {post.demo && <DemoNotice inline />}
    </p>
  );
}

/** an event's dates set large - "12–14" over "March 2027" - read out as the full range */
function EventDate({ post, large }: { post: JournalPost; large?: boolean }) {
  const start = post.event?.start ?? post.date;
  const d = dateParts(start, post.event?.end);
  return (
    <p className="text-burgundy">
      <span className="sr-only">{formatRange(start, post.event?.end)}</span>
      <span aria-hidden="true" className={cx('block font-serif leading-none tracking-[-0.01em]', large ? 'text-[clamp(3.5rem,8vw,6.5rem)]' : 'text-[clamp(2.2rem,4vw,3.2rem)]')}>
        {d.days}
      </span>
      <span aria-hidden="true" className="mt-2 block type-label">
        {d.month}
      </span>
    </p>
  );
}

/**
 * "Read story →": the one link of a story, stretched over its whole card (the
 * card is `relative`), so the card is clickable without nested links. Its
 * name carries the title.
 */
function ReadLink({ post, button, className }: { post: JournalPost; button?: boolean; className?: string }) {
  const label = (
    <>
      Read story<span className="sr-only">: {post.title}</span>
    </>
  );
  if (button)
    return (
      <ButtonLink to={`/journal/${post.slug}`} arrow className={cx('w-fit after:absolute after:inset-0', className)}>
        {label}
      </ButtonLink>
    );
  return (
    <Link
      to={`/journal/${post.slug}`}
      className={cx(
        'inline-flex min-h-11 w-fit items-center gap-2 type-label whitespace-nowrap text-ink after:absolute after:inset-0 hover:text-burgundy',
        className,
      )}
    >
      <span className="underline decoration-burgundy decoration-1 underline-offset-[6px]">{label}</span>
      <span aria-hidden="true" className="transition-transform group-hover/card:translate-x-1 motion-reduce:transition-none">
        &rarr;
      </span>
    </Link>
  );
}

/** the featured story: its photograph large beside it, or - without one - set as type, the date large */
function Feature({ post, upcoming, pictured }: { post: JournalPost; upcoming: boolean; pictured: boolean }) {
  return (
    <section aria-label="Featured story" className="mx-auto max-w-page px-page-x pt-[clamp(2rem,6vh,4rem)]">
      <article className="group/card relative grid gap-x-[clamp(2rem,5vw,5.5rem)] gap-y-7 tablet:grid-cols-12 tablet:items-center">
        {pictured ? (
          <ContentPicture
            picture={post.image}
            ratio="4 / 5"
            sizes="(min-width: 1100px) 44vw, (min-width: 700px) 46vw, 92vw"
            demo={post.demo}
            // the page's lead image, in the first screen: never left waiting on lazy loading
            priority
            className="tablet:col-span-6 desktop:col-span-6"
          />
        ) : (
          <div className="border-y border-rule py-[clamp(1.5rem,5vh,3rem)] tablet:col-span-5 tablet:self-stretch tablet:border-y-0 tablet:border-r tablet:py-0 tablet:pr-[clamp(1.5rem,4vw,4rem)]">
            <EventDate post={post} large />
            {post.event && <p className="mt-5 type-meta text-ink">{post.event.location}</p>}
          </div>
        )}
        <div className={cx(pictured ? 'tablet:col-span-6 desktop:col-span-5 desktop:col-start-8' : 'tablet:col-span-7')}>
          <p className="type-eyebrow text-ink">
            Featured <span className="text-ink-muted">· {upcoming ? 'Upcoming' : 'Recent'}</span>
          </p>
          <Kicker post={post} className="mt-5" />
          <h2 className="mt-3 max-w-[18ch] font-serif text-[clamp(2rem,4.4vw,3.7rem)] leading-[1.02] tracking-[-0.015em] transition-colors group-hover/card:text-burgundy">
            {post.title}
          </h2>
          <p className="mt-5 max-w-[44ch] text-lede text-ink-soft">{post.summary}</p>
          {post.event && (
            <dl className="mt-6 grid max-w-[30rem] grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-t border-rule type-meta">
              <dt className="border-b border-rule py-2.5 text-ink-muted">Event</dt>
              <dd className="border-b border-rule py-2.5 text-ink">{post.event.name}</dd>
              <dt className="border-b border-rule py-2.5 text-ink-muted">Dates</dt>
              <dd className="border-b border-rule py-2.5 text-ink">{formatRange(post.event.start, post.event.end)}</dd>
              <dt className="border-b border-rule py-2.5 text-ink-muted">Where</dt>
              <dd className="border-b border-rule py-2.5 text-ink">{post.event.location}</dd>
            </dl>
          )}
          <ReadLink post={post} button className="mt-7" />
        </div>
      </article>
    </section>
  );
}

/**
 * Recent's lead: its photograph beside it (smaller than the feature's), the
 * text settled at the foot of the picture; across the whole band when it is
 * alone, else two thirds of it beside the column of others.
 */
function Lead({ post, pictured, alone }: { post: JournalPost; pictured: boolean; alone: boolean }) {
  return (
    <article
      className={cx(
        'group/card relative grid gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-6 tablet:grid-cols-12 tablet:items-end',
        alone ? 'desktop:col-span-12' : 'desktop:col-span-8',
      )}
    >
      {pictured && (
        <ContentPicture
          picture={post.image}
          ratio="4 / 5"
          sizes={alone ? '(min-width: 700px) 38vw, 92vw' : '(min-width: 1100px) 30vw, (min-width: 700px) 45vw, 92vw'}
          demo={post.demo}
          className={alone ? 'tablet:col-span-5' : 'tablet:col-span-6'}
        />
      )}
      <div className={cx(pictured ? (alone ? 'tablet:col-span-6 tablet:col-start-7' : 'tablet:col-span-6') : 'tablet:col-span-9', pictured && 'tablet:pb-8')}>
        <Kicker post={post} />
        <h3 className="mt-3 max-w-[22ch] font-serif text-[clamp(1.7rem,3vw,2.6rem)] leading-[1.06] transition-colors group-hover/card:text-burgundy">
          {post.title}
        </h3>
        <p className="mt-4 max-w-[52ch] text-body leading-copy text-ink-soft">{post.summary}</p>
        <ReadLink post={post} className="mt-3" />
      </div>
    </article>
  );
}

