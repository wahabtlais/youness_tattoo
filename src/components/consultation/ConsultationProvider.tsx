import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { ConsultationEntry } from '../../domain/consultation';
import { useAfterLoad } from '../../hooks/useAfterLoad';
import { ConsultationContext, RESUME_KEY } from './consultationContext';
import { draftKey, newDraft, reopenDraft, type DraftState } from './consultationDraft';

// the panel's code isn't needed for the first paint: it loads once the page is
// idle - or at once, if the consultation is opened before that
const ConsultationPanel = lazy(() => import('./ConsultationPanel').then((m) => ({ default: m.ConsultationPanel })));

/** the open consultation's mark in the address (one history entry, so Back closes it) */
const PARAM = 'consult';

/** history entries the consultation pushed carry this, alongside what was there */
const pushedHere = () => !!(window.history.state?.usr as { consultation?: boolean } | null)?.consultation;
const isOpenInUrl = () => new URLSearchParams(window.location.search).has(PARAM);

/**
 * One consultation for the whole site, reachable from any page with where
 * it was opened from (`entry`). It keeps the client's drafts for the visit:
 * one for general entries (Ask Younes, the booking section) and one per
 * piece they started from in Find Similar. Reopening resumes a draft where
 * it was; nothing outlives the page (docs/UX_FLOWS.md).
 *
 * Open, it adds `?consult` to the address as one history entry, so the
 * browser's Back closes it (keeping the draft) instead of moving whatever
 * is underneath. The controls never depend on the address, so the pages
 * using them don't re-render as it changes.
 */
export function ConsultationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [active, setActive] = useState<string | null>(null);

  const open = useCallback(
    (entry: ConsultationEntry) => {
      const key = draftKey(entry);
      setDrafts((all) => ({ ...all, [key]: all[key] ? reopenDraft(all[key], entry) : newDraft(entry) }));
      setActive(key);
      if (isOpenInUrl()) return;
      const params = new URLSearchParams(window.location.search);
      params.set(PARAM, '');
      navigate(
        { pathname: window.location.pathname, search: `?${params}` },
        // keep what the page underneath keeps in history (e.g. Find Similar's steps)
        { state: { ...(window.history.state?.usr ?? {}), consultation: true } },
      );
    },
    [navigate],
  );

  const close = useCallback(() => {
    if (!isOpenInUrl()) return;
    if (pushedHere()) {
      navigate(-1);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.delete(PARAM);
    const search = params.toString();
    navigate({ pathname: window.location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [navigate]);

  // arriving on a consultation address by a reload or a link: there is no
  // draft to show (nothing is stored) - drop the mark
  const inUrl = new URLSearchParams(location.search).has(PARAM);
  useEffect(() => {
    if (inUrl && !pushedHere()) close();
  }, [inUrl, close]);

  const update = useCallback(
    (change: (draft: DraftState) => DraftState) => {
      if (!active) return;
      setDrafts((all) => (all[active] ? { ...all, [active]: change(all[active]) } : all));
    },
    [active],
  );

  // back from signing in (pages/AccountPage leaves a one-time mark): the
  // consultation they'd started reopens where it was. The mark is used up
  // either way, so closing it and going Back never reopens it.
  useEffect(() => {
    let marked = false;
    try {
      marked = sessionStorage.getItem(RESUME_KEY) === '1';
      if (marked) sessionStorage.removeItem(RESUME_KEY);
    } catch {
      /* storage blocked: nothing to resume */
    }
    if (!marked || !active || !drafts[active] || isOpenInUrl()) return;
    // once the page they came back to has drawn
    const entry = drafts[active].consultation.entry;
    const t = window.setTimeout(() => open(entry), 0);
    return () => window.clearTimeout(t);
  }, [location.pathname, active, drafts, open]);

  const controls = useMemo(() => ({ open, close }), [open, close]);
  const draft = inUrl && active ? (drafts[active] ?? null) : null;
  const idle = useAfterLoad();

  return (
    <ConsultationContext value={controls}>
      {children}
      {(idle || draft) && (
        <Suspense fallback={null}>
          <ConsultationPanel draft={draft} onChange={update} onClose={close} />
        </Suspense>
      )}
    </ConsultationContext>
  );
}
