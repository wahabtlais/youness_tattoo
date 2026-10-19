import type { ConsultationEntry, PreferenceSignal } from '../../domain/consultation';
import type { TattooWork } from '../../domain/work';
import { rankByPreferences } from '../../domain/workMatching';

/**
 * Find Similar's model: what a client can say about a piece, what they keep
 * along the way, and what goes on to the consultation. Plain data - the
 * components render it, nothing here touches the DOM.
 */

/** what can speak to someone about a piece - their answer, not the piece's metadata */
export const PREFERENCES: { signal: PreferenceSignal; label: string; hint?: string }[] = [
  { signal: 'subject', label: 'Subject', hint: 'What it shows' },
  { signal: 'composition', label: 'Composition', hint: 'How it sits and flows' },
  { signal: 'linework', label: 'Linework and detail' },
  { signal: 'style', label: 'Style' },
  { signal: 'mood', label: 'Mood or feeling' },
  { signal: 'placement', label: 'Placement', hint: 'Where it sits on the body' },
  { signal: 'other', label: 'Something else', hint: 'Say it in your own words below' },
];

export const preferenceLabel = (signal: PreferenceSignal) =>
  PREFERENCES.find((p) => p.signal === signal)?.label ?? signal;

/** one visit to Find Similar, kept while the page is open so closing never loses it */
export interface FindSimilarSession {
  /** the piece they started from */
  origin: string;
  drawnTo: PreferenceSignal[];
  note: string;
  /** pieces kept for the consultation, in the order kept */
  kept: string[];
  /** pieces they said were not for them */
  setAside: string[];
  /** which group of suggestions is showing */
  page: number;
}

export const newSession = (origin: string): FindSimilarSession => ({
  origin,
  drawnTo: [],
  note: '',
  kept: [],
  setAside: [],
  page: 0,
});

/** controls stay a comfortable touch size below desktop (44px) */
export const TAP = 'inline-flex min-h-11 items-center desktop:min-h-0';

/** how many suggestions show at a time */
export const PAGE_SIZE = 4;

/**
 * The pieces to suggest: the rest of the archive (never the piece they
 * started from, nothing they set aside), in archive order from the
 * starting piece on - then ordered by what they said speaks to them, by
 * the metadata matching in domain/workMatching (stable, so archive order
 * breaks ties). Kept pieces stay in it; keeping never reorders anything.
 */
export function suggestionPool(pieces: TattooWork[], session: FindSimilarSession) {
  const start = pieces.findIndex((p) => p.id === session.origin);
  const origin = pieces[start];
  const inOrder = pieces
    .slice(start + 1)
    .concat(pieces.slice(0, Math.max(start, 0)))
    .filter((p) => p.id !== session.origin && !session.setAside.includes(p.id));
  if (!origin) return inOrder;
  return rankByPreferences(origin, inOrder, session.drawnTo).map((m) => m.piece);
}

/**
 * How the suggestions are ordered, for the page to say so: by their
 * answers or in archive order, and whether the descriptions behind the
 * order are demo data rather than verified by Younes.
 */
export function suggestionBasis(pieces: TattooWork[], session: FindSimilarSession) {
  const byAnswers = session.drawnTo.some((p) => p !== 'other');
  const demo = byAnswers && pieces.some((p) => p.metadataStatus === 'demo');
  return { byAnswers, demo };
}

/** the group of suggestions on show (it wraps round as the pool shrinks) */
export function suggestionPage(pool: TattooWork[], page: number) {
  const pages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
  const at = ((page % pages) + pages) % pages;
  return { items: pool.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE), at, pages };
}

/** the typed handoff into the existing consultation entry point */
export function toConsultation(session: FindSimilarSession): ConsultationEntry {
  const note = session.note.trim();
  return {
    from: 'find-similar',
    workId: session.origin,
    selection: {
      drawnTo: session.drawnTo,
      ...(note ? { note } : {}),
      references: session.kept,
    },
  };
}
