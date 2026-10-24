import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import { StateMessage } from '../../components/ui/StateMessage';
import { CALL_STATUS_LABEL, type CanvasCall, type CanvasCallStatus } from '../../domain/canvasCall';
import { journalKindLabel, journalWhen, JOURNAL_KINDS, type JournalKind, type JournalPost } from '../../domain/journal';
import type { ImageAsset } from '../../domain/media';
import type { TattooWork } from '../../domain/work';
import { useCanvasCalls, useJournal } from '../../hooks/useContent';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useWork } from '../../hooks/useWork';
import { cx } from '../../lib/cx';
import { formatDate, formatRange, today } from '../../lib/date';
import { DashIcon } from '../DashIcon';
import { EmptyState, NotConnected } from '../components/EmptyState';
import { DemoMark, PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { ago, plural } from '../format';
import { SearchField } from '../inquiries/SearchField';
import { StatusBadge } from '../inquiries/StatusBadge';
import { STUDIO_ROOT } from '../navigation';
import { inquiriesForCall, inquiryPath } from '../records';
import { button } from '../ui';
import { useOverview } from '../useOverview';
import { OffSite, PublishSwitch, TestimonialsCard } from '../publishing/publishState';
import { useStudioItems } from '../publishing/useStudioItems';

const ROOT = `${STUDIO_ROOT}/publishing`;
type Type = 'journal' | 'calls';

/** a call's state, in a tone: open is the live one; the rest are quieter */
const CALL_TONE: Record<CanvasCallStatus, string> = { open: 'success', upcoming: 'info', booked: 'neutral', closed: 'neutral' };
const WHEN_LABEL = { upcoming: 'Upcoming event', recent: 'Recent', archive: 'Archive' } as const;

/**
 * /studio/publishing/journal|calls[/:slug] - the public site's two kinds
 * of writing, side by side but distinct: the Journal (what has happened
 * and is coming - conventions, guest spots, results) and Canvas Calls (a
 * specific tattoo Younes wants to do, looking for the person to wear it).
 * Each lists what the site holds, with the facts its model has - a post's
 * kind, date and event; a call's status, deadline, placement and offer -
 * and a preview of the chosen item, its public page, the pieces it shows
 * and, for a call, the inquiries that answered it. Each can be taken off
 * the public site and put back (saved, and recorded in the history); the
 * same goes for the client words on the home page. Sample content is
 * marked so. Writing new posts and calls isn't built yet.
 */
export function PublishingPage() {
  const [now] = useState(() => new Date());
  const { type: rawType, slug } = useParams();
  const navigate = useNavigate();
  const type: Type = rawType === 'calls' ? 'calls' : 'journal';
  const journal = useJournal();
  const calls = useCanvasCalls();
  const work = useWork();
  const overview = useOverview(now);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<JournalKind | 'all'>('all');
  const studioPosts = useStudioItems('journal');
  const studioCalls = useStudioItems('calls');
  const items = type === 'calls' ? studioCalls : studioPosts;
  const stateOf = (s: string) => items.list?.find((i) => i.slug === s);

  const posts = journal.status === 'success' ? journal.data.items : [];
  const callItems = calls.status === 'success' ? calls.data.items : [];
  const post = type === 'journal' ? posts.find((p) => p.slug === slug) : undefined;
  const call = type === 'calls' ? callItems.find((c) => c.slug === slug) : undefined;
  useDocumentTitle(post?.title ?? call?.title ?? (type === 'calls' ? 'Canvas Calls' : 'Journal'));

  if (journal.status !== 'success' || calls.status !== 'success' || work.status !== 'success' || overview.status !== 'success') {
    return <StateMessage kind="loading" title="Loading the site’s content…" />;
  }
  const pieces = work.data;
  const pieceOf = (id: string) => pieces.find((w) => w.id === id);
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (s: string) => words.every((w) => s.toLowerCase().includes(w));
  const shownPosts = posts.filter((p) => (kind === 'all' || p.kind === kind) && hit(`${p.title} ${p.summary} ${p.event?.name ?? ''} ${p.event?.location ?? ''}`));
  const shownCalls = callItems.filter((c) => hit(`${c.title} ${c.summary} ${c.placement ?? ''}`));
  const selected = post ?? call;
  const demo = journal.data.demo || calls.data.demo;
  const day = today();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Journal & Canvas Calls"
        trail={selected ? [{ label: 'Journal & Canvas Calls', to: `${ROOT}/${type}` }, { label: selected.title }] : undefined}
        summary="What the public site says about the studio — stories and news in the Journal, specific tattoos looking for their person in Canvas Calls."
        demo={false}
        actions={
          <>
            <NotConnected icon="publishing" label={type === 'calls' ? 'New call' : 'New post'} reason="Writing new ones here isn’t built yet" />
            {demo && <DemoMark>Demo content — as on the public site</DemoMark>}
          </>
        }
      />

      <div className="grid items-start gap-5 @min-[64rem]:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
        <section aria-label={type === 'calls' ? 'Canvas calls' : 'Journal posts'} className={cx('studio-card min-w-0 overflow-hidden', selected && '@max-[64rem]:hidden')}>
          <div className="grid gap-3 border-b border-rule p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Content"
                value={type}
                onChange={(t) => {
                  setText('');
                  navigate(`${ROOT}/${t}`);
                }}
                options={[
                  { value: 'journal', label: 'Journal', count: posts.length },
                  { value: 'calls', label: 'Canvas Calls', count: callItems.length },
                ]}
              />
              <p className="text-[0.8125rem] text-ink-muted">{type === 'calls' ? `${callItems.filter((c) => c.status === 'open').length} open now` : `${posts.filter((p) => journalWhen(p, day) === 'upcoming').length} about upcoming events`}</p>
            </div>
            <SearchField value={text} onChange={setText} label={type === 'calls' ? 'Search canvas calls' : 'Search the journal'} placeholder={type === 'calls' ? 'Search by title or placement…' : 'Search by title, event or place…'} />
            {type === 'journal' && (
              <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
                {[{ value: 'all' as const, label: 'All kinds' }, ...JOURNAL_KINDS].map((k) => {
                  const n = k.value === 'all' ? posts.length : posts.filter((p) => p.kind === k.value).length;
                  if (!n) return null;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      aria-pressed={kind === k.value}
                      onClick={() => setKind(k.value)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-(--studio-line-strong) px-3 text-[0.8125rem] font-semibold text-ink-soft transition-colors hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid aria-pressed:border-burgundy aria-pressed:bg-(--studio-selected) aria-pressed:text-ink"
                    >
                      {k.label}
                      <span className="text-ink-muted tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {type === 'journal' ? (
            shownPosts.length === 0 ? (
              <EmptyState icon="publishing" title={posts.length ? 'No posts match.' : 'The journal is empty.'} className="m-4">
                {posts.length ? 'Try another word or kind.' : 'Nothing is published in the Journal yet.'}
              </EmptyState>
            ) : (
              <ul aria-label="Posts" className="divide-y divide-rule">
                {shownPosts.map((p) => {
                  const when = journalWhen(p, day);
                  return (
                    <li key={p.slug}>
                      <Row to={`${ROOT}/journal/${p.slug}`} current={p.slug === slug} thumb={<Thumb image={postImage(p, pieceOf)} />}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Chip>{journalKindLabel(p.kind)}</Chip>
                          <Chip tone={when === 'upcoming' ? 'info' : undefined}>{WHEN_LABEL[when]}</Chip>
                          {p.demo && <Chip tone="brand">Demo</Chip>}
                          {stateOf(p.slug)?.published === false && <Chip tone="attention">Off the site</Chip>}
                        </span>
                        <span className="mt-1 block text-[0.9375rem] leading-snug font-semibold text-ink">{p.title}</span>
                        <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">
                          Published {formatDate(p.date)}
                          {p.event && ` · ${p.event.location}`}
                        </span>
                      </Row>
                    </li>
                  );
                })}
              </ul>
            )
          ) : shownCalls.length === 0 ? (
            <EmptyState icon="publishing" title={callItems.length ? 'No calls match.' : 'No canvas calls yet.'} className="m-4">
              {callItems.length ? 'Try another word.' : 'Nothing is listed in Canvas Calls yet.'}
            </EmptyState>
          ) : (
            <ul aria-label="Calls" className="divide-y divide-rule">
              {shownCalls.map((c) => {
                const responses = inquiriesForCall(overview.data, c.slug).length;
                return (
                  <li key={c.slug}>
                    <Row to={`${ROOT}/calls/${c.slug}`} current={c.slug === slug} thumb={<Thumb image={callImage(c, pieceOf)} />}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <CallStatus s={c.status} />
                        {c.demo && <Chip tone="brand">Demo</Chip>}
                        {stateOf(c.slug)?.published === false && <Chip tone="attention">Off the site</Chip>}
                      </span>
                      <span className="mt-1 block text-[0.9375rem] leading-snug font-semibold text-ink">{c.title}</span>
                      <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">
                        {[c.placement, c.deadline && `Respond by ${formatDate(c.deadline)}`, `${plural(responses, 'sample response')}`].filter(Boolean).join(' · ')}
                      </span>
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}
          {items.list && <OffSite items={items.list} known={new Set((type === 'calls' ? callItems : posts).map((x) => x.slug))} onSet={items.setPublished} what={type === 'calls' ? 'call' : 'post'} />}
        </section>

        {post ? (
          <PostView p={post} pieceOf={pieceOf} calls={callItems} publish={<PublishSwitch item={stateOf(post.slug)} onSet={items.setPublished} what="post" />} />
        ) : call ? (
          <CallView c={call} pieceOf={pieceOf} posts={posts} responses={inquiriesForCall(overview.data, call.slug)} now={now} publish={<PublishSwitch item={stateOf(call.slug)} onSet={items.setPublished} what="call" />} />
        ) : slug ? (
          <EmptyState icon="publishing" title="There’s nothing at this address." action={<Link to={`${ROOT}/${type}`} className="font-semibold text-burgundy hover:underline">Back to the list</Link>} />
        ) : (
          <EmptyState icon="publishing" title={type === 'calls' ? 'Choose a call' : 'Choose a post'} className="min-h-80 @max-[64rem]:hidden">
            A preview, its public page and everything it links to appear here.
          </EmptyState>
        )}
      </div>

      <TestimonialsCard />
    </div>
  );
}

const postImage = (p: JournalPost, pieceOf: (id: string) => TattooWork | undefined): ImageAsset | undefined =>
  p.image ? ('workId' in p.image ? pieceOf(p.image.workId)?.image : p.image.image) : undefined;
const callImage = (c: CanvasCall, pieceOf: (id: string) => TattooWork | undefined): ImageAsset | undefined =>
  c.artwork.kind === 'design' ? c.artwork.image : c.artwork.kind === 'reference' ? pieceOf(c.artwork.workId)?.image : undefined;

function Thumb({ image }: { image?: ImageAsset }) {
  return image ? (
    <ResponsiveImage image={image} alt="" ratio="1 / 1" sizes="64px" frameClassName="size-16 rounded-(--studio-r-sm)" />
  ) : (
    <span aria-hidden="true" className="grid size-16 place-items-center rounded-(--studio-r-sm) border border-dashed border-(--studio-line-strong) text-ink-muted">
      <DashIcon name="portfolio" className="size-5" />
    </span>
  );
}

function Row({ to, current, thumb, children }: { to: string; current: boolean; thumb: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={cx('relative grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-4 py-3 transition-colors hover:bg-(--studio-hover)', current && 'bg-(--studio-selected) hover:bg-(--studio-selected)')}
    >
      {current && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-burgundy" />}
      {thumb}
      <span className="min-w-0">{children}</span>
    </Link>
  );
}

function Chip({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span data-tone={tone ?? 'neutral'} className="inline-flex h-6 items-center rounded-full bg-(--st-bg) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
      {children}
    </span>
  );
}

function CallStatus({ s }: { s: CanvasCallStatus }) {
  return (
    <span data-tone={CALL_TONE[s]} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-(--st-line) bg-(--st-bg) px-2 text-[0.75rem] font-semibold text-(--st-fg)">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
      {CALL_STATUS_LABEL[s]}
    </span>
  );
}

function Preview({ id, image, alt, head, children, publicTo, publish }: { id: string; image?: ImageAsset; alt: string; head: ReactNode; children: ReactNode; publicTo: string; publish: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [id]);
  return (
    <article aria-labelledby="contentTitle" className="studio-card min-w-0 overflow-hidden">
      {image ? (
        <div className="bg-(--studio-sunken)">
          <ResponsiveImage image={image} alt={alt} ratio="16 / 10" sizes="(min-width: 1024px) 30rem, 100vw" />
        </div>
      ) : (
        <div className="grid aspect-[16/10] place-items-center bg-(--studio-sunken) text-[0.875rem] text-ink-muted">No artwork yet</div>
      )}
      <div className="grid gap-4 p-5">
        <div>
          {head}
          <h2 id="contentTitle" ref={heading} tabIndex={-1} className="studio-title mt-2 text-[1.6rem] leading-tight outline-none">
            {id}
          </h2>
        </div>
        {children}
        <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
          <a href={publicTo} target="_blank" rel="noreferrer" className={button('secondary', 'sm')}>
            Open the public page
            <DashIcon name="external" />
          </a>
          {publish}
        </div>
      </div>
    </article>
  );
}

function Related({ title, items }: { title: string; items: { key: string; to: string; label: string; tag: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <h3 className="text-[0.8125rem] font-semibold text-ink-muted">{title}</h3>
      <ul className="mt-1.5 grid gap-1.5">
        {items.map((i) => (
          <li key={i.key}>
            <Link to={i.to} className="flex items-center gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2 text-[0.875rem] font-semibold text-ink transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
              <span className="rounded-full bg-(--studio-sunken) px-2 py-0.5 text-[0.6875rem] text-ink-soft">{i.tag}</span>
              <span className="truncate">{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostView({ p, pieceOf, calls, publish }: { p: JournalPost; pieceOf: (id: string) => TattooWork | undefined; calls: CanvasCall[]; publish: ReactNode }) {
  const pieceIds = [...new Set([...(p.image && 'workId' in p.image ? [p.image.workId] : []), ...(p.workIds ?? [])])];
  return (
    <Preview
      publish={publish}
      id={p.title}
      image={postImage(p, pieceOf)}
      alt={p.image && 'alt' in p.image ? p.image.alt : ''}
      publicTo={`/journal/${p.slug}`}
      head={
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip>{journalKindLabel(p.kind)}</Chip>
          {p.demo && <Chip tone="brand">Demo post</Chip>}
          <span className="text-[0.8125rem] text-ink-muted">Published {formatDate(p.date)}</span>
        </span>
      }
    >
      {p.event && (
        <p data-tone="info" className="flex items-start gap-2 rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-ink">
          <DashIcon name="calendar" className="mt-0.5 size-4 shrink-0 text-(--st-fg)" />
          <span>
            <span className="font-semibold">{p.event.name}</span> · {p.event.location} · {formatRange(p.event.start, p.event.end)}
          </span>
        </p>
      )}
      <p className="text-[1rem] leading-snug font-medium text-ink">{p.summary}</p>
      <div className="grid gap-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        {p.body.slice(0, 2).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        {p.body.length > 2 && <p className="text-[0.8125rem] text-ink-muted">+ {plural(p.body.length - 2, 'more paragraph')} on the public page</p>}
      </div>
      <Related title="Pieces it shows" items={pieceIds.map((id) => ({ key: id, to: `${STUDIO_ROOT}/portfolio/${id}`, label: `Piece ${id}`, tag: 'Portfolio' }))} />
      <Related title="Canvas calls it mentions" items={(p.callSlugs ?? []).map((s) => ({ key: s, to: `${ROOT}/calls/${s}`, label: calls.find((c) => c.slug === s)?.title ?? s, tag: 'Call' }))} />
    </Preview>
  );
}

function CallView({ c, pieceOf, posts, responses, now, publish }: { c: CanvasCall; pieceOf: (id: string) => TattooWork | undefined; posts: JournalPost[]; responses: ReturnType<typeof inquiriesForCall>; now: Date; publish: ReactNode }) {
  const pieceIds = [...new Set([...(c.artwork.kind === 'reference' ? [c.artwork.workId] : []), ...(c.workIds ?? [])])];
  const event = c.eventSlug ? posts.find((p) => p.slug === c.eventSlug) : undefined;
  const facts = [
    ['Placement', c.placement],
    ['Scale', c.scale],
    ['Respond by', c.deadline && formatDate(c.deadline)],
    ['Offer', c.offer],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <Preview
      publish={publish}
      id={c.title}
      image={callImage(c, pieceOf)}
      alt={c.artwork.kind === 'design' ? c.artwork.alt : ''}
      publicTo={`/canvas-calls/${c.slug}`}
      head={
        <span className="flex flex-wrap items-center gap-1.5">
          <CallStatus s={c.status} />
          {c.demo && <Chip tone="brand">Demo call</Chip>}
        </span>
      }
    >
      <p className="text-[1rem] leading-snug font-medium text-ink">{c.summary}</p>
      {facts.length > 0 && (
        <dl className="grid gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3 text-[0.875rem] @min-[30rem]:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.75rem] font-medium text-ink-muted">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {c.eligibility && c.eligibility.length > 0 && (
        <div>
          <h3 className="text-[0.8125rem] font-semibold text-ink-muted">Conditions</h3>
          <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-[0.875rem] text-ink-soft">
            {c.eligibility.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <section aria-labelledby="callResponses">
        <h3 id="callResponses" className="text-[0.8125rem] font-semibold text-ink-muted">
          Responses · {responses.length}
        </h3>
        {responses.length === 0 ? (
          <p className="mt-1 text-[0.875rem] text-ink-soft">No inquiry in the sample data answers this call.</p>
        ) : (
          <ul className="mt-1.5 grid gap-1.5">
            {responses.map((q) => (
              <li key={q.id}>
                <Link to={inquiryPath(q)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2 transition-colors hover:border-(--studio-line-strong) hover:bg-(--studio-hover)">
                  <span className="min-w-0">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{q.clientName}</span>
                    <span className="block text-[0.75rem] text-ink-muted">{ago(now, q.receivedAt)}</span>
                  </span>
                  <StatusBadge status={q.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Related title="Pieces it shows" items={pieceIds.map((id) => ({ key: id, to: `${STUDIO_ROOT}/portfolio/${id}`, label: `Piece ${id}`, tag: 'Portfolio' }))} />
      <Related title="Journal post about its event" items={event ? [{ key: event.slug, to: `${ROOT}/journal/${event.slug}`, label: event.title, tag: 'Journal' }] : []} />
    </Preview>
  );
}
