import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useConsultation } from '../components/consultation/consultationContext';
import { FindSimilar } from '../components/find-similar/FindSimilar';
import { useOpenFindSimilar } from '../components/find-similar/useFindSimilarRoute';
import { StateMessage } from '../components/ui/StateMessage';
import { FilterMenu } from '../components/work/portfolio/FilterMenu';
import { Pagination } from '../components/work/portfolio/Pagination';
import { RopeGallery } from '../components/work/portfolio/RopeGallery';
import { PortfolioDetail } from '../components/work/portfolio/PortfolioDetail';
import { PortfolioSearch } from '../components/work/portfolio/PortfolioSearch';
import { traitLabel } from '../domain/work';
import { FACETS, emptyQuery, facetOptions, isEmptyQuery, searchWork, type WorkFacet, type WorkQuery } from '../domain/workSearch';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useWork } from '../hooks/useWork';
import { cx } from '../lib/cx';
import { pageInfo } from '../lib/pagination';

/** pieces per page: three rows of three on desktop */
const WORK_PAGE_SIZE = 9;
const two = (n: string | number) => String(n).padStart(2, '0');

/** the query lives in the address, so a filtered view can be shared or reloaded */
function readQuery(params: URLSearchParams): WorkQuery {
  const q = emptyQuery();
  q.text = params.get('q') ?? '';
  for (const { facet } of FACETS) q.picked[facet] = params.get(facet)?.split(',').filter(Boolean) ?? [];
  return q;
}

/**
 * Page size. In development only, `?pageSize=3` overrides it - a test seam,
 * so paging can be exercised on today's eight real pieces without inventing
 * any. Production always uses WORK_PAGE_SIZE.
 */
function pageSize(params: URLSearchParams) {
  const override = import.meta.env.DEV ? Number(params.get('pageSize')) : NaN;
  return Number.isInteger(override) && override > 0 ? override : WORK_PAGE_SIZE;
}

interface PieceState {
  /** this history entry was pushed by opening a piece from the grid */
  portfolioPiece?: boolean;
}

/**
 * /work - the whole portfolio, for browsing at leisure (the home page's
 * archive is the theatrical way in; this is the reference shelf).
 *
 * The address holds the whole view, so it can be shared, reloaded and
 * walked with Back / Forward:
 *   ?q=        search text           (typing replaces the entry)
 *   ?style= ?subject= ?placement= ?colour=   comma-separated choices
 *   ?page=     2, 3… (absent on page 1; search or filters reset it;
 *              out of range is clamped, the address corrected)
 *   ?piece=    a piece open over the grid (Work Detail V1)
 * Turning a page and opening a piece push entries; search and filters
 * replace the current one. The canonical address of a piece is still
 * /work/:slug, which opens it over the archive on the home page.
 *
 * While the metadata is demo data, the search and filters say so: they sort
 * by sample values, not by descriptions of these photographs.
 */
export function WorkPage() {
  const work = useWork();
  const consultation = useConsultation();
  const openFindSimilar = useOpenFindSimilar();
  const reduced = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<WorkFacet | null>(null);
  const [filtersShown, setFiltersShown] = useState(false);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const openPieceData = work.status === 'success' ? work.data.find((p) => p.slug === params.get('piece')) : undefined;
  useDocumentTitle(openPieceData ? `${openPieceData.title} ${openPieceData.id}` : 'Work');

  // the view, worked out from the address
  const pieces = work.status === 'success' ? work.data : [];
  const query = readQuery(params);
  const results = searchWork(pieces, query);
  const size = pageSize(params);
  const requested = Number(params.get('page') ?? '1');
  const paging = pageInfo(results.length, requested, size);

  // a page that doesn't exist (an old link, or fewer results now): correct the address
  const clampTo = work.status === 'success' && params.has('page') && requested !== paging.page ? paging.page : null;
  useEffect(() => {
    if (clampTo === null) return;
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (clampTo > 1) out.set('page', String(clampTo));
        else out.delete('page');
        return out;
      },
      { replace: true },
    );
  }, [clampTo, setParams]);

  // after a page turn: bring the results' top into view and put focus on their heading
  const turned = useRef(false);
  useEffect(() => {
    if (!turned.current) return;
    turned.current = false;
    const h = resultsRef.current;
    if (!h) return;
    h.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
    h.focus({ preventScroll: true });
  }, [paging.page, reduced]);

  const closeMenus = useCallback(() => setOpenMenu(null), []);

  if (work.status !== 'success') {
    return (
      <StateMessage
        kind={work.status === 'loading' ? 'loading' : 'error'}
        title={work.status === 'loading' ? 'The portfolio is being printed.' : 'The portfolio could not be loaded.'}
        className="min-h-svh justify-center px-page-x"
        action={work.status === 'error' && work.retry ? { label: 'Try again', onClick: work.retry } : undefined}
      />
    );
  }

  const facets = facetOptions(pieces);
  const sample = pieces.some((p) => p.metadataStatus === 'demo');
  const filtering = !isEmptyQuery(query);
  const activeCount = FACETS.reduce((n, { facet }) => n + query.picked[facet].length, 0);
  const pieceSlug = params.get('piece');
  const shown = results.slice(paging.from, paging.to);

  /** search and filters: replace the entry, back to page 1 */
  const setQuery = (next: WorkQuery) => {
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (next.text) out.set('q', next.text);
        else out.delete('q');
        for (const { facet } of FACETS) {
          if (next.picked[facet].length) out.set(facet, next.picked[facet].join(','));
          else out.delete(facet);
        }
        out.delete('page');
        return out;
      },
      { replace: true },
    );
  };
  const toggle = (facet: WorkFacet, value: string) => {
    const now = query.picked[facet];
    setQuery({ ...query, picked: { ...query.picked, [facet]: now.includes(value) ? now.filter((v) => v !== value) : [...now, value] } });
  };
  const clearFilters = () => setQuery({ ...emptyQuery(), text: query.text });

  /** a page turn: its own history entry, so Back returns to the page before */
  const goPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 1) next.set('page', String(n));
    else next.delete('page');
    turned.current = true;
    navigate({ search: next.size ? `?${next}` : '' });
  };

  const openPiece = (slug: string, replace = false) => {
    const next = new URLSearchParams(params);
    next.set('piece', slug);
    navigate({ search: `?${next}` }, replace ? { replace: true, state: location.state } : { state: { portfolioPiece: true } satisfies PieceState });
  };
  const closePiece = () => {
    if ((location.state as PieceState | null)?.portfolioPiece) navigate(-1);
    else {
      const next = new URLSearchParams(params);
      next.delete('piece');
      navigate({ search: next.size ? `?${next}` : '' }, { replace: true });
    }
  };

  const chips = FACETS.flatMap(({ facet, label }) => query.picked[facet].map((value) => ({ facet, label, value })));
  const countLine = filtering
    ? `${results.length} of ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`
    : `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`;
  const rangeLine = paging.pages > 1 ? ` · showing ${paging.from + 1}–${paging.to}, page ${paging.page} of ${paging.pages}` : '';

  return (
    <>
      {/* the archive's introduction: the title on the left; on the right what the
          archive is and how much is in it - then the controls, then the rail the
          ropes hang from */}
      <header className="mx-auto max-w-page px-page-x pt-[clamp(6.75rem,14vh,9rem)]">
        <div className="grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-5 desktop:grid-cols-12 desktop:items-end">
          <div className="desktop:col-span-7">
            <p className="type-eyebrow text-burgundy">/ Portfolio · the archive</p>
            <h1 className="mt-3 font-serif text-[clamp(3rem,7.5vw,6.25rem)] leading-[0.9] tracking-[-0.02em]">The work</h1>
          </div>
          <div className="grid gap-4 desktop:col-span-5 desktop:pb-2">
            <p className="max-w-[44ch] text-body leading-copy text-ink-soft">
              Every piece in the archive, photographed as it left the studio — more are added as they are photographed.
            </p>
            <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-rule pt-3">
              <div className="flex items-baseline gap-2.5">
                <dt className="type-meta text-ink-soft">Pieces</dt>
                <dd className="font-serif text-title leading-none text-ink">{two(pieces.length)}</dd>
              </div>
              <div className="flex items-baseline gap-2.5">
                <dt className="type-meta text-ink-soft">Photographed</dt>
                <dd className="type-meta text-ink">as delivered</dd>
              </div>
            </dl>
            {sample && (
              <p className="type-meta leading-normal text-burgundy">
                Sample metadata — the filters use demo values, not descriptions of these pieces
              </p>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Search and filters" className="mx-auto max-w-page px-page-x pt-[clamp(1.5rem,3.5vh,2.25rem)]">
        <PortfolioSearch value={query.text} onChange={(text) => setQuery({ ...query, text })} sample={sample} />

        {/* the filter toolbar: four compact menus; below 700px folded behind "Filters" */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-3">
          <button
            type="button"
            aria-expanded={filtersShown}
            aria-controls="workFilters"
            onClick={() => setFiltersShown((s) => !s)}
            className={cx(
              'inline-flex min-h-11 items-center gap-2.5 border px-4 type-label tablet:hidden',
              activeCount ? 'border-burgundy text-burgundy' : 'border-ink/30 text-ink',
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 14 10" className="w-3.5 stroke-current" strokeWidth="1.3">
              <path d="M0 1.5h14M3 5h8M5.5 8.5h3" />
            </svg>
            Filters{activeCount > 0 && ` (${activeCount})`}
          </button>
          <div id="workFilters" className={cx('flex flex-wrap items-center gap-2', !filtersShown && 'max-tablet:hidden max-tablet:w-full')}>
            <span className="mr-1 type-meta text-ink-soft max-tablet:w-full">Filter by</span>
            {facets.map((f) => (
              <FilterMenu
                key={f.facet}
                label={f.label}
                options={f.values}
                selected={query.picked[f.facet]}
                onToggle={(v) => toggle(f.facet, v)}
                open={openMenu === f.facet}
                onOpenChange={(o) => setOpenMenu(o ? f.facet : null)}
              />
            ))}
          </div>
          {activeCount > 0 && (
            <button type="button" onClick={clearFilters} className="min-h-11 px-1 type-label text-ink underline decoration-burgundy underline-offset-[6px] hover:text-burgundy">
              Clear filters
            </button>
          )}
        </div>

        {chips.length > 0 && (
          <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={`${c.facet}-${c.value}`}>
                <button
                  type="button"
                  onClick={() => toggle(c.facet, c.value)}
                  aria-label={`Remove ${c.label.toLowerCase()} filter: ${traitLabel(c.value)}`}
                  className="inline-flex min-h-9 items-center gap-2 border border-burgundy/50 bg-paper-light px-3 type-meta text-burgundy transition-colors hover:border-burgundy"
                >
                  <span className="text-ink-soft">{c.label}:</span> {traitLabel(c.value)}
                  <span aria-hidden="true" className="text-[0.9em]">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 ref={resultsRef} tabIndex={-1} className="type-meta text-ink-soft outline-none focus-visible:outline-2">
            <span aria-live="polite">
              {countLine}
              {rangeLine}
            </span>
          </h2>
          {(filtering || query.text) && (
            <button type="button" onClick={() => setQuery(emptyQuery())} className="min-h-11 type-label text-ink-soft underline decoration-burgundy underline-offset-4 hover:text-burgundy">
              Show every piece
            </button>
          )}
        </div>
      </section>

      {pieceSlug && !pieces.some((p) => p.slug === pieceSlug) && (
        // a link to a piece that isn't here: say so, rather than quietly showing the grid
        <div role="status" className="mx-auto mt-6 flex max-w-page flex-wrap items-baseline gap-x-6 gap-y-2 px-page-x">
          <p className="border-l border-burgundy pl-4 font-serif text-lede text-ink">
            There’s no piece “{pieceSlug}” in the portfolio.
          </p>
          <button type="button" onClick={closePiece} className="min-h-11 type-label text-ink underline decoration-burgundy underline-offset-4">
            Dismiss
          </button>
        </div>
      )}

      <section aria-label="Pieces" onPointerDownCapture={closeMenus} className="mx-auto max-w-page px-page-x pt-[clamp(0.5rem,1.5vh,1rem)] pb-[clamp(3rem,8vh,5rem)]">
        {results.length === 0 ? (
          <StateMessage
            kind="empty"
            title="Nothing matches all of those."
            detail="Try fewer filters or other words."
            action={{ label: 'Clear search and filters', onClick: () => setQuery(emptyQuery()) }}
          />
        ) : (
          <RopeGallery pieces={shown} total={pieces.length} onOpen={(p) => openPiece(p.slug)} />
        )}

        {paging.pages > 1 && (
          <div className="mt-[clamp(2.5rem,6vh,3.5rem)] grid justify-items-center gap-3 border-t border-rule pt-6">
            <Pagination page={paging.page} pages={paging.pages} onPage={goPage} label="Portfolio pages" />
            <p className="type-meta text-ink-soft">
              Page {paging.page} of {paging.pages}
            </p>
          </div>
        )}

        <p className="mt-[clamp(2.5rem,7vh,4rem)] border-t border-rule pt-5 type-meta text-ink-soft">
          <Link to={{ pathname: '/', hash: '#work' }} className="text-ink underline decoration-burgundy underline-offset-4">
            See them hung in the archive
          </Link>{' '}
          — the same pieces, on the rope.
        </p>
      </section>

      <PortfolioDetail
        pieces={pieces}
        slug={pieceSlug && pieces.some((p) => p.slug === pieceSlug) ? pieceSlug : null}
        onClose={closePiece}
        onFindSimilar={(piece) => openFindSimilar(piece.id)}
        onOpen={(slug) => openPiece(slug, true)}
      />
      <FindSimilar pieces={pieces} onContinue={consultation.open} />
    </>
  );
}
