import { Link } from 'react-router';
import { ContentPicture } from '../components/content/ContentParts';
import { ButtonLink } from '../components/ui/ButtonLink';
import { DemoNotice } from '../components/ui/DemoNotice';
import { Reveal } from '../components/ui/Reveal';
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
 * The Journal on the home page, as one magazine spread on its own bright
 * stock (paper-light): an introduction that says what the Journal covers,
 * then a lead story with its picture beside a column of two more. Every
 * story has the same parts - category, date, headline, summary, "Read the
 * story" - and the whole story is one link. What's coming comes first.
 * Renders nothing when nothing is published.
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
    <section id="journal" aria-labelledby="journalHeading" className="bg-paper-light px-page-x py-[clamp(4rem,11vh,7.5rem)]">
      <Reveal className="mx-auto max-w-page">
        <header className="grid items-end gap-x-[clamp(2rem,6vw,5rem)] gap-y-5 border-b border-ink pb-[clamp(1.5rem,4vh,2.25rem)] tablet:grid-cols-2 desktop:grid-cols-12">
          <div className="desktop:col-span-7">
            <p className="type-eyebrow text-burgundy">{copy.eyebrow}</p>
            <h2 id="journalHeading" className="mt-4 max-w-[16ch] type-heading text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02]">
              {copy.heading}
            </h2>
          </div>
          <div className="grid gap-4 desktop:col-span-4 desktop:col-start-9 desktop:pb-1">
            <p className="max-w-[38ch] text-body leading-copy text-ink-soft">{copy.intro}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {demo && <DemoNotice>Demo content — fictional examples</DemoNotice>}
              {/* the way to the whole Journal: the same framed button as "All canvas calls" */}
              <ButtonLink to="/journal" arrow>
                Read the journal
              </ButtonLink>
            </div>
          </div>
        </header>

        <div className="mt-[clamp(2rem,5vh,3rem)] grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 desktop:grid-cols-12">
          <Story post={lead} now={now} lead className="desktop:col-span-7" />
          {rest.length > 0 && (
            <ul className="grid content-start desktop:col-span-5">
              {rest.map((p) => (
                <li key={p.slug} className="border-t border-rule py-6 first:border-t-0 first:pt-0 max-desktop:first:border-t max-desktop:first:pt-6">
                  <Story post={p} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function Story({ post, now, lead, className }: { post: JournalPost; now: string; lead?: boolean; className?: string }) {
  const upcoming = journalWhen(post, now) === 'upcoming';
  return (
    <article className={cx('group relative', lead && post.image && 'grid gap-6 tablet:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] tablet:items-start', className)}>
      {lead && post.image && (
        <ContentPicture picture={post.image} ratio="4 / 5" sizes="(min-width: 1100px) 26vw, (min-width: 700px) 40vw, 18rem" demo={post.demo} className="max-tablet:max-w-[18rem]" />
      )}
      <div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 type-meta">
          <span className="text-burgundy">{KIND[post.kind]}</span>
          <span className="text-ink-soft">
            {upcoming && post.event ? `Coming up · ${formatRange(post.event.start, post.event.end)}` : formatDate(post.date)}
          </span>
        </p>
        <h3 className={cx('mt-3 font-serif leading-[1.08]', lead ? 'max-w-[18ch] text-[clamp(1.75rem,3vw,2.6rem)]' : 'max-w-[24ch] text-title')}>
          {/* the headline's link covers the whole story */}
          <Link to={`/journal/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-burgundy">
            {post.title}
          </Link>
        </h3>
        <p className={cx('mt-3 max-w-[46ch] leading-copy text-ink-soft', lead ? 'text-lede font-serif' : 'text-body')}>{post.summary}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
          {/* the story's action: visibly a link before any hover - a burgundy underline that
              thickens, and an arrow that steps on, on hover and keyboard focus. Not a link of its
              own: the headline's link already covers the whole story */}
          <span
            aria-hidden="true"
            className="inline-flex min-h-11 items-center gap-2.5 type-label text-ink transition-colors group-focus-within:text-burgundy group-hover:text-burgundy"
          >
            <span className="underline decoration-burgundy decoration-1 underline-offset-[7px] transition-[text-decoration-thickness] group-focus-within:decoration-2 group-hover:decoration-2 motion-reduce:transition-none">
              Read the story
            </span>
            <span className="transition-transform duration-(--duration-fast) ease-editorial group-focus-within:translate-x-1 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-focus-within:translate-x-0 motion-reduce:group-hover:translate-x-0">
              &rarr;
            </span>
          </span>
          {post.demo && <DemoNotice inline />}
        </p>
      </div>
    </article>
  );
}
