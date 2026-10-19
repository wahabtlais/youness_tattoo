import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

/**
 * Find Similar lives in the address, on top of whatever page it opened over
 * (normally a piece's /work/:slug):
 *
 *   ?similar=03               step 1 - what speaks to you about piece 03
 *   ?similar=03&step=pieces   step 2 - more of the work, keeping references
 *
 * Each step is pushed onto history, so the browser's Back walks back through
 * it to the piece the client started from. Only the search part changes:
 * the path - and so the work detail open underneath - is never touched.
 */

export type FindSimilarStep = 'preferences' | 'pieces';

const ORIGIN = 'similar';
const STEP = 'step';

/** history entries Find Similar pushed carry how deep into it they are */
interface FindSimilarState {
  findSimilar?: number;
}

export function useFindSimilarRoute() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const origin = params.get(ORIGIN);
  const step: FindSimilarStep = params.get(STEP) === 'pieces' ? 'pieces' : 'preferences';
  /** how many entries Find Similar itself pushed to get here (0: arrived by a link or reload) */
  const depth = (location.state as FindSimilarState | null)?.findSimilar ?? 0;

  const go = useCallback(
    (to: { origin: string | null; step?: FindSimilarStep }, push: number | null) => {
      const next = new URLSearchParams(location.search);
      next.delete(ORIGIN);
      next.delete(STEP);
      if (to.origin) {
        next.set(ORIGIN, to.origin);
        if (to.step === 'pieces') next.set(STEP, 'pieces');
      }
      const search = next.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : '' },
        push === null ? { replace: true } : { state: { findSimilar: push } satisfies FindSimilarState },
      );
    },
    [location.pathname, location.search, navigate],
  );

  /** begin Find Similar on a piece */
  const open = useCallback((workId: string) => go({ origin: workId }, depth + 1), [go, depth]);

  /** on to the suggestions */
  const toPieces = useCallback(() => origin && go({ origin, step: 'pieces' }, depth + 1), [go, origin, depth]);

  /** one step back: the suggestions to the question, the question to the page underneath */
  const back = useCallback(() => {
    if (depth > 0) navigate(-1);
    else go(step === 'pieces' && origin ? { origin } : { origin: null }, null);
  }, [depth, navigate, go, step, origin]);

  /** leave Find Similar altogether, back to the page it opened over */
  const close = useCallback(() => {
    if (depth > 0) navigate(-depth);
    else go({ origin: null }, null);
  }, [depth, navigate, go]);

  return { origin, step, depth, open, toPieces, back, close };
}

/**
 * Just the way in, for the page that hosts Find Similar: it doesn't follow
 * the address, so moving through Find Similar never re-renders the page
 * (the hero, the archive) around it.
 */
export function useOpenFindSimilar() {
  const navigate = useNavigate();
  return useCallback(
    (workId: string) => {
      const params = new URLSearchParams(window.location.search);
      params.delete(STEP);
      params.set(ORIGIN, workId);
      navigate(
        { pathname: window.location.pathname, search: `?${params}` },
        { state: { findSimilar: 1 } satisfies FindSimilarState },
      );
    },
    [navigate],
  );
}
