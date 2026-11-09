import { Link } from 'react-router';
import { ContentPicture } from '../components/content/ContentParts';
import { ButtonLink } from '../components/ui/ButtonLink';
import { DemoNotice } from '../components/ui/DemoNotice';
import { journalWhen, type JournalKind, type JournalPost } from '../domain/journal';
import { useJournal } from '../hooks/useContent';
import { useSiteContent } from '../hooks/useSiteContent';
import { cx } from '../lib/cx';
import { formatDate, formatRange, today } from '../lib/date';

/** one story's kind, in the singular, as its category line reads */
const KIND: Record<JournalKind, string> = {
  convention: 'Convention',
  'guest-spot': 'Guest spot',
  award: 'Result',
  studio: 'Studio news',
  announcement: 'Announcement',
};

/**
 * The Journal on the home page, set as the front page of a small studio
 * paper (the bright paper-light stock): a nameplate between double rules, a
 * dateline (today, what the Journal covers, the way to all of it), then a
 * lead story with its picture beside a column of shorter ones, each led by
 * its date as a large numeral - a page, not a grid of cards. What's coming
 * up comes first. Every story is one link. Renders nothing when nothing is
 * published.
 */
export function JournalPreview() {
  const journal = useJournal();
  const copy = useSiteContent().content.journal;
  if (journal.status !== 'success' || journal.data.items.length === 0) return null;
  const { items, demo } = journal.data;
  const now = today();
  const upcoming = items.filter((p) => journalWhen(p, now) === 'upcoming').sort((a, b) => (a.event!.start < b.event!.start ? -1 : 1));
  const shown = [...upcoming, ...items.filter((p) => journalWhen(p, now) !== 'upcoming')].slice(0, 3);
  // the lead is the first story that has a picture to lead with
  const lead = shown.find((p) => p.image) ?? shown[0];
  const rest = shown.filter((p) => p !== lead);

  return (
    <section id="journal" aria-labelledby="journalHeading" className="bg-paper-light px-page-x py-[clamp(4.5rem,12vh,8rem)]">
      <div className="mx-auto max-w-page">
        {/* the nameplate */}
        <header>
          <div className="border-t-[3px] border-ink pt-[3px]">
            <div className="border-t border-ink" />
          </div>
          <p className="mt-3 flex items-baseline justify-between type-meta text-ink-soft">
            <span>
              <span className="text-burgundy">06</span> · From the studio
            </span>
            <span className="hidden tablet:inline">Detroit, Michigan</span>
          </p>
          <h2 id="journalHeading" className="mt-2 text-center font-serif text-[clamp(4rem,14vw,11.5rem)] leading-[0.86] tracking-[-0.03em]">
            {copy.eyebrow}
          </h2>
          <div className="mt-4 grid items-center gap-x-6 gap-y-3 border-y border-ink py-3 tablet:grid-cols-[1fr_auto_1fr]">
            <p className="type-meta text-ink">{formatDate(now)}</p>
            <p className="font-serif text-[1.1rem] italic tablet:text-center">{copy.heading}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 tablet:justify-end">
              {demo && <DemoNotice inline>Demo content — fictional examples</DemoNotice>}
              <Link
                to="/journal"
                className="inline-flex min-h-11 items-center gap-2 type-label text-ink underline decoration-burgundy underline-offset-[7px] hover:text-burgundy"
              >
                Read the journal <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
          <p className="mt-6 max-w-[56ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
        </header>

        <div className="mt-[clamp(2.5rem,6vh,3.5rem)] grid gap-x-[clamp(2rem,4vw,4rem)] gap-y-12 desktop:grid-cols-12">
          <LeadStory post={lead} now={now} className="desktop:col-span-8" />
          {rest.length > 0 && (
            <ul className="grid content-start gap-y-8 desktop:col-span-4 desktop:border-l desktop:border-ink/20 desktop:pl-[clamp(1.5rem,3vw,2.5rem)]">
              {rest.map((p) => (
                <li key={p.slug} className="border-t border-ink/20 pt-6 first:border-t-0 first:pt-0 max-desktop:first:border-t max-desktop:first:pt-6">
                  <ColumnStory post={p} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-[clamp(2.5rem,6vh,3.5rem)] border-t-[3px] border-ink" />
        <ButtonLink to="/journal" arrow className="mt-8 tablet:hidden">
          Read the journal
        </ButtonLink>
      </div>
    </section>
  );
}

/** a story's category and date, as the paper's small caps */
function Dateline({ post, now }: { post: JournalPost; now: string }) {
  const upcoming = journalWhen(post, now) === 'upcoming';
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 type-meta">
      <span className="text-burgundy">{KIND[post.kind]}</span>
      <span className="text-ink-soft">{upcoming && post.event ? `Coming up · ${formatRange(post.event.start, post.event.end)}` : formatDate(post.date)}</span>
    </p>
  );
}

function ReadMore({ demo }: { demo?: boolean }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
      {/* visibly a link before any hover; not one of its own - the headline's link covers the story */}
      <span aria-hidden="true" className="inline-flex min-h-11 items-center gap-2.5 type-label text-ink transition-colors group-focus-within:text-burgundy group-hover:text-burgundy">
        <span className="underline decoration-burgundy decoration-1 underline-offset-[7px] group-focus-within:decoration-2 group-hover:decoration-2">Read the story</span>
        <span className="transition-transform group-focus-within:translate-x-1 group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
      </span>
      {demo && <DemoNotice inline />}
    </p>
  );
}

function LeadStory({ post, now, className }: { post: JournalPost; now: string; className?: string }) {
  return (
    <article className={cx('group relative grid gap-x-[clamp(1.5rem,3vw,2.5rem)] gap-y-6', post.image && 'tablet:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]', className)}>
      {post.image && (
        <ContentPicture picture={post.image} ratio="4 / 5" sizes="(min-width: 1100px) 34vw, (min-width: 700px) 48vw, 100vw" demo={post.demo} />
      )}
      <div className="tablet:pt-2">
        <Dateline post={post} now={now} />
        <h3 className="mt-4 max-w-[16ch] font-serif text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.04] text-balance">
          <Link to={`/journal/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-burgundy">
            {post.title}
          </Link>
        </h3>
        {/* a drop cap: the first letter of the summary, as a paper's lead */}
        <p className="mt-5 max-w-[40ch] font-serif text-lede text-ink-soft first-letter:float-left first-letter:mt-[0.06em] first-letter:mr-2 first-letter:font-serif first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:text-burgundy">
          {post.summary}
        </p>
        <ReadMore demo={post.demo} />
      </div>
    </article>
  );
}

function ColumnStory({ post, now }: { post: JournalPost; now: string }) {
  const upcoming = journalWhen(post, now) === 'upcoming';
  const day = (upcoming && post.event ? post.event.start : post.date).slice(8, 10);
  return (
    <article className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-5">
      <p aria-hidden="true" className="font-serif text-[clamp(2.8rem,4vw,3.6rem)] leading-[0.82] text-burgundy">
        {day}
      </p>
      <div>
        <Dateline post={post} now={now} />
        <h3 className="mt-2.5 max-w-[22ch] font-serif text-[clamp(1.35rem,1.9vw,1.65rem)] leading-[1.12] text-balance">
          <Link to={`/journal/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-burgundy">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2.5 max-w-[40ch] text-body leading-copy text-ink-soft">{post.summary}</p>
        <ReadMore demo={post.demo} />
      </div>
    </article>
  );
}
