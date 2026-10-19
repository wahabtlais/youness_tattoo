import type { PreferenceSignal } from './consultation';
import type { TattooTraits, TattooWork } from './work';

/**
 * Basic metadata matching for Find Similar - no AI, no randomness: the same
 * answers always give the same order.
 *
 * A visitor says what speaks to them about the piece they started from
 * ("its subject", "its linework"). For each of those, every other piece is
 * compared with the starting piece on that one trait:
 *
 *   shares a value with it        2 points   (a match)
 *   either side not described     1 point    (unknown - could be a match)
 *   both described, nothing shared 0 points   (a known difference)
 *
 * so missing metadata never counts as a mismatch: an undescribed piece
 * ranks below known matches and above known differences. Ties go to the
 * piece sharing more values overall, then to archive order. With no
 * answers (or only "something else", which has no trait) nothing is
 * scored and the archive order stands.
 */

/** the trait each preference is about ('other' has none - it is in their words) */
const TRAIT: Partial<Record<PreferenceSignal, keyof TattooTraits>> = {
  subject: 'subject',
  composition: 'composition',
  linework: 'linework',
  style: 'style',
  mood: 'mood',
  placement: 'placement',
};

const values = (piece: TattooWork, trait: keyof TattooTraits): string[] => {
  const v = piece[trait];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
};

export interface WorkMatch {
  piece: TattooWork;
  score: number;
  /** the preferences this piece shares with the starting piece */
  shared: PreferenceSignal[];
}

/**
 * `candidates` in order of how well they share what the visitor said they
 * like about `origin`. Stable: equal scores keep the candidates' own order.
 */
export function rankByPreferences(
  origin: TattooWork,
  candidates: TattooWork[],
  prefs: PreferenceSignal[],
): WorkMatch[] {
  const traits = prefs.map((p) => [p, TRAIT[p]] as const).filter((t): t is [PreferenceSignal, keyof TattooTraits] => !!t[1]);
  const scored = candidates.map((piece, order) => {
    let score = 0;
    let overlap = 0;
    const shared: PreferenceSignal[] = [];
    for (const [pref, trait] of traits) {
      const mine = values(origin, trait);
      const theirs = values(piece, trait);
      if (!mine.length || !theirs.length) {
        score += 1;
        continue;
      }
      const common = theirs.filter((v) => mine.includes(v)).length;
      if (common > 0) {
        score += 2;
        overlap += common;
        shared.push(pref);
      }
    }
    return { piece, score, shared, overlap, order };
  });
  scored.sort((a, b) => b.score - a.score || b.overlap - a.overlap || a.order - b.order);
  return scored.map(({ piece, score, shared }) => ({ piece, score, shared }));
}
