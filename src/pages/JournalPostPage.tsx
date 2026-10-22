import { Link, useParams } from 'react-router';
import { BackLink, ContentPicture, RelatedWork, StatusTag } from '../components/content/ContentParts';
import { usePieces } from '../hooks/usePieces';
import { DemoNotice } from '../components/ui/DemoNotice';
import { NotFound } from '../components/layout/NotFound';
import { journalKindLabel, journalWhen } from '../domain/journal';
import { useCanvasCalls, useJournal } from '../hooks/useContent';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate, formatRange, today } from '../lib/date';

/**
 * /journal/:slug - one post: its category and date, the headline, the
 * event's particulars when it is about one, the picture, the story, then
 * what it connects to (pieces, canvas calls) and the posts either side.
 * An unknown slug says so and points back to the Journal.
 */
export function JournalPostPage() {
  const { slug } = useParams();
  const journal = useJournal();
  const calls = useCanvasCalls();
  const items = journal.status === 'success' ? journal.data.items : [];
  const at = items.findIndex((p) => p.slug === slug);
  const post = at >= 0 ? items[at] : null;
  useDocumentTitle(post ? post.title : null); // not found: NotFound titles the tab
  const pieces = usePieces(post?.workIds);

  if (!post) {
    return (
      <NotFound
        title="That story isn’t in the journal."
        links={[
          { to: '/journal', label: 'Back to the journal' },
          { to: '/', label: 'Back to the studio' },
        ]}
      />
    );
  }

  const related = calls.status === 'success' ? calls.data.items.filter((c) => post.callSlugs?.includes(c.slug)) : [];
  const newer = at > 0 ? items[at - 1] : null;
  const older = at < items.length - 1 ? items[at + 1] : null;
  const when = journalWhen(post, today());

  return (
    <article className="mx-auto max-w-page px-page-x pt-[clamp(6.5rem,15vh,9rem)] pb-[clamp(3rem,8vh,5rem)]">
      <BackLink to="/journal">Journal</BackLink>

      <header className="mt-[clamp(1.5rem,4vh,2.5rem)] grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-6 border-b border-rule pb-[clamp(1.75rem,4vh,2.75rem)] desktop:grid-cols-12 desktop:items-end">
        <div className="desktop:col-span-8">
          <p className="flex flex-wrap gap-x-4 gap-y-1 type-meta text-ink-soft">
            <span className="text-burgundy">{journalKindLabel(post.kind)}</span>
            <span>{formatDate(post.date)}</span>
          </p>
          <h1 className="mt-4 max-w-[20ch] font-serif text-[clamp(2.2rem,5.2vw,4.4rem)] leading-[1.02] tracking-[-0.015em]">{post.title}</h1>
          <p className="mt-5 max-w-[46ch] font-serif text-lede text-ink-soft italic">{post.summary}</p>
        </div>
        {post.demo && (
          <div className="desktop:col-span-4 desktop:pb-2">
            <DemoNotice>
              {post.kind === 'award' ? 'Fictional result — not a real achievement. Demo content.' : 'Demo content — a fictional example'}
            </DemoNotice>
          </div>
        )}
      </header>

      <div className="mt-[clamp(2rem,5vh,3.5rem)] grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-10 desktop:grid-cols-12">
        <div className="desktop:col-span-7">
          {post.image && (
            <ContentPicture picture={post.image} sizes="(min-width: 1100px) 55vw, 92vw" demo={post.demo} className="mb-[clamp(2rem,5vh,3rem)] max-w-[40rem]" />
          )}
          <div className="grid max-w-[62ch] gap-5 font-serif text-[clamp(1.05rem,1.3vw,1.25rem)] leading-[1.6] text-ink">
            {post.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-8 desktop:col-span-4 desktop:col-start-9">
          {post.event && (
            <dl className="border-t border-ink pt-4">
              <p className="mb-3 type-eyebrow text-burgundy">{when === 'upcoming' ? 'Coming up' : 'The event'}</p>
              {[
                ['Event', post.event.name],
                ['Where', post.event.location],
                ['When', formatRange(post.event.start, post.event.end)],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 border-t border-rule py-2.5 first:border-t-0">
                  <dt className="type-meta text-ink-muted">{k}</dt>
                  <dd className="text-body text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {related.length > 0 && (
            <nav aria-label="Related canvas calls" className="border-t border-rule pt-5">
              <p className="mb-3 type-meta text-ink-soft">Canvas calls for this</p>
              <ul className="grid gap-3">
                {related.map((c) => (
                  <li key={c.slug}>
                    <Link to={`/canvas-calls/${c.slug}`} className="group block">
                      <StatusTag status={c.status} />
                      <span className="mt-1 block font-serif text-lede group-hover:text-burgundy">{c.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <RelatedWork pieces={pieces} title="Pieces mentioned" />
        </aside>
      </div>

      {(newer || older) && (
        <nav aria-label="More stories" className="mt-[clamp(3rem,8vh,5rem)] grid gap-6 border-t border-ink pt-5 tablet:grid-cols-2">
          {older ? (
            <Link to={`/journal/${older.slug}`} className="group block">
              <span className="type-meta text-ink-muted">&larr; Older</span>
              <span className="mt-1.5 block font-serif text-lede group-hover:text-burgundy">{older.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link to={`/journal/${newer.slug}`} className="group block tablet:text-right">
              <span className="type-meta text-ink-muted">Newer &rarr;</span>
              <span className="mt-1.5 block font-serif text-lede group-hover:text-burgundy">{newer.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
