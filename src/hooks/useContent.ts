import { statusOn, type CanvasCall } from '../domain/canvasCall';
import { today } from '../lib/date';
import type { JournalPost } from '../domain/journal';
import { CANVAS_CALLS } from '../data/canvasCalls';
import { JOURNAL } from '../data/journal';
import type { AsyncState } from '../lib/async';
import { published } from '../lib/publicContent';

/**
 * The data boundary for the Journal and Canvas Calls, like useWork: static
 * today, a fetch later, and nothing that calls these changes. `demo` says
 * the records are fictional examples (the pages label them).
 */
export interface Collection<T> {
  items: T[];
  demo: boolean;
}

// published records from the page when the server provided them; the bundled ones otherwise
const bundle = published();
const newestFirst = (posts: JournalPost[]) => [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));

const journal: AsyncState<Collection<JournalPost>> = {
  status: 'success',
  data: bundle
    ? { items: newestFirst(bundle.journal), demo: bundle.journal.some((p) => p.demo) }
    : JOURNAL.status === 'awaiting'
      ? { items: [], demo: false }
      : { items: newestFirst(JOURNAL.posts), demo: JOURNAL.status === 'demo' },
};

// each call's status as of today: past its deadline, an open call is closed
const calls: AsyncState<Collection<CanvasCall>> = {
  status: 'success',
  data: bundle
    ? { items: bundle.calls.map((c) => ({ ...c, status: statusOn(c, today()) })), demo: bundle.calls.some((c) => c.demo) }
    : CANVAS_CALLS.status === 'awaiting'
      ? { items: [], demo: false }
      : { items: CANVAS_CALLS.calls.map((c) => ({ ...c, status: statusOn(c, today()) })), demo: CANVAS_CALLS.status === 'demo' },
};

/** the journal's posts, newest first */
export function useJournal(): AsyncState<Collection<JournalPost>> {
  return journal;
}

/** the canvas calls, in their authored order */
export function useCanvasCalls(): AsyncState<Collection<CanvasCall>> {
  return calls;
}
