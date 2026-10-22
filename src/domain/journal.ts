import type { ImageAsset } from './media';

/**
 * The Journal: what has happened and what is coming - conventions, guest
 * spots, results, studio news. (Canvas Calls are separate: specific tattoos
 * Younes wants to do - domain/canvasCall.ts. The two can point at each
 * other.)
 */
export type JournalKind = 'convention' | 'guest-spot' | 'award' | 'studio' | 'announcement';

export const JOURNAL_KINDS: { value: JournalKind; label: string }[] = [
  { value: 'convention', label: 'Conventions' },
  { value: 'guest-spot', label: 'Guest spots' },
  { value: 'award', label: 'Results & awards' },
  { value: 'studio', label: 'Studio' },
  { value: 'announcement', label: 'Announcements' },
];
export const journalKindLabel = (k: JournalKind) => JOURNAL_KINDS.find((x) => x.value === k)!.label;

/** an event a post is about: where and when (dates ISO 8601, yyyy-mm-dd) */
export interface JournalEvent {
  name: string;
  /** city, venue - as precise as is confirmed */
  location: string;
  start: string;
  end?: string;
}

/** the picture a post leads with: one of Younes's pieces, or its own photograph */
export type JournalImage =
  | { workId: string; caption?: string }
  | { image: ImageAsset; alt: string; caption?: string };

export interface JournalPost {
  /** marks a fictional post, written to evaluate the design - shown as such everywhere */
  demo?: true;
  /** URL segment for /journal/:slug - stable once published */
  slug: string;
  kind: JournalKind;
  title: string;
  /** publication date, yyyy-mm-dd */
  date: string;
  /** one or two sentences for the lists */
  summary: string;
  /** the article, one paragraph per entry */
  body: string[];
  image?: JournalImage;
  event?: JournalEvent;
  /** pieces it mentions (by work id) */
  workIds?: string[];
  /** canvas calls it relates to (by slug) */
  callSlugs?: string[];
}

/**
 * Where a post sits in time, for the index:
 * - 'upcoming'  its event hasn't finished yet
 * - 'recent'    published within the last year
 * - 'archive'   older
 */
export type JournalWhen = 'upcoming' | 'recent' | 'archive';

export function journalWhen(post: JournalPost, today: string): JournalWhen {
  const end = post.event ? (post.event.end ?? post.event.start) : null;
  if (end && end >= today) return 'upcoming';
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  return post.date >= yearAgo ? 'recent' : 'archive';
}

/**
 * The journal's content, in one of three states (as for testimonials):
 * - 'awaiting'   nothing to show: the home preview hides, the page says so
 * - 'demo'       fictional posts, labelled everywhere, to evaluate the design
 * - 'published'  real posts
 */
export type JournalContent =
  | { status: 'awaiting' }
  | { status: 'demo'; posts: (JournalPost & { demo: true })[] }
  | { status: 'published'; posts: JournalPost[] };
