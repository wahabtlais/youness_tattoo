/**
 * Numbered pagination, as pure functions: which slice a page shows, and
 * which page numbers to offer (all of them when few, otherwise the first,
 * the last and the current one with its neighbours, with gaps between).
 */
export interface PageInfo {
  /** 1-based, clamped into range */
  page: number;
  pages: number;
  /** indexes into the full list: [from, to) */
  from: number;
  to: number;
}

export function pageInfo(total: number, requested: number, size: number): PageInfo {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const from = (page - 1) * size;
  return { page, pages, from, to: Math.min(total, from + size) };
}

/** e.g. [1, 'gap', 4, 5, 6, 'gap', 12] - at most 7 entries */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => keep.add(n));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}
