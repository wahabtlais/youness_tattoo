import { traitLabel, type TattooWork } from './work';

/**
 * Searching and filtering the portfolio (the /work page). Pure functions
 * over TattooWork, so the page only renders what they return.
 *
 * Facets are offered only for what the data actually describes: a facet
 * appears when at least two different values exist across the pieces, and
 * lists only those values. Within a facet, values widen the selection (any
 * of them); across facets, they narrow it (all of them). The search words
 * must all be found in a piece's title, number, tags or described traits.
 */
export type WorkFacet = 'style' | 'subject' | 'placement' | 'colour';

export const FACETS: { facet: WorkFacet; label: string }[] = [
  { facet: 'style', label: 'Style' },
  { facet: 'subject', label: 'Subject' },
  { facet: 'placement', label: 'Placement' },
  { facet: 'colour', label: 'Colour' },
];

export interface WorkQuery {
  text: string;
  picked: Record<WorkFacet, string[]>;
}

export const emptyQuery = (): WorkQuery => ({ text: '', picked: { style: [], subject: [], placement: [], colour: [] } });

/** a piece's values for a facet, as a list */
function valuesOf(piece: TattooWork, facet: WorkFacet): string[] {
  const v = piece[facet];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** the facets worth offering, each with its values and how many pieces have each */
export function facetOptions(pieces: TattooWork[]) {
  return FACETS.map(({ facet, label }) => {
    const counts = new Map<string, number>();
    for (const p of pieces) for (const v of valuesOf(p, facet)) counts.set(v, (counts.get(v) ?? 0) + 1);
    const values = [...counts].map(([value, count]) => ({ value, label: traitLabel(value), count })).sort((a, b) => a.label.localeCompare(b.label));
    return { facet, label, values };
  }).filter((f) => f.values.length >= 2);
}

/** everything a piece can be found by */
function haystack(p: TattooWork) {
  const traits = [...valuesOf(p, 'style'), ...valuesOf(p, 'subject'), ...valuesOf(p, 'placement'), ...valuesOf(p, 'colour'), ...(p.mood ?? []), ...(p.composition ?? [])].map(traitLabel);
  return [p.title, p.id, ...(p.tags ?? []), ...traits].join(' ').toLowerCase();
}

export function searchWork(pieces: TattooWork[], q: WorkQuery): TattooWork[] {
  const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
  return pieces.filter((p) => {
    for (const { facet } of FACETS) {
      const want = q.picked[facet];
      if (want.length && !valuesOf(p, facet).some((v) => want.includes(v))) return false;
    }
    if (!words.length) return true;
    const text = haystack(p);
    return words.every((w) => text.includes(w));
  });
}

export const isEmptyQuery = (q: WorkQuery) => !q.text.trim() && FACETS.every(({ facet }) => q.picked[facet].length === 0);
