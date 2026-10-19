import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ConsultationEntry, PreferenceSignal } from '../../domain/consultation';
import type { TattooWork } from '../../domain/work';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { newSession, suggestionPool, TAP, toConsultation, type FindSimilarSession } from './findSimilarSession';
import { FindSimilarPieces } from './FindSimilarPieces';
import { FindSimilarPreferences } from './FindSimilarPreferences';
import { useFindSimilarRoute } from './useFindSimilarRoute';

interface FindSimilarProps {
  pieces: TattooWork[];
  /** hand what they chose to the consultation (which opens over this) */
  onContinue: (entry: ConsultationEntry) => void;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Find Similar: from a piece the visitor loves into a consultation that
 * already knows it. Two steps on one sheet over the page - what speaks to
 * them about the piece, then more of Younes's work to keep or set aside -
 * and a typed handoff (`FindSimilarSelection`) to the consultation.
 *
 * Opened and stepped through the address (useFindSimilarRoute), so the
 * browser's Back walks back to the piece. What they chose stays while the
 * page is open: closing and coming back to the same piece picks up where
 * they left off.
 */
export function FindSimilar({ pieces, onContinue }: FindSimilarProps) {
  const route = useFindSimilarRoute();
  const origin = pieces.find((p) => p.id === route.origin) ?? null;
  const [stored, setStored] = useState<FindSimilarSession | null>(null);
  // a new starting piece begins a new session; the same one resumes it
  const session = origin ? (stored?.origin === origin.id ? stored : newSession(origin.id)) : null;
  const update = (change: (s: FindSimilarSession) => Partial<FindSimilarSession>) => {
    if (!origin) return;
    setStored((prev) => {
      const base = prev?.origin === origin.id ? prev : newSession(origin.id);
      return { ...base, ...change(base) };
    });
  };

  // Arriving on a Find Similar address by a reload or a link, the piece it
  // belongs to opens on its own a moment later and would cover this sheet:
  // drop back to the piece instead (nothing was chosen yet anyway). An
  // unknown piece goes the same way.
  const { close, depth } = route;
  useEffect(() => {
    if (route.origin !== null && (depth === 0 || !origin)) close();
  }, [route.origin, depth, origin, close]);

  // each step starts at the top, with focus on its question (not mid-sheet).
  // The focus waits for the dialog's own effect, which opens it and would
  // otherwise move focus to its first control.
  const dialogRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const sheet = dialogRef.current?.closest('dialog');
    if (sheet) sheet.scrollTop = 0;
  }, [route.step, origin]);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('#findSimilarTitle')?.focus({ preventScroll: true });
  }, [route.step, origin]);

  const open = origin !== null && session !== null && depth > 0;
  const place = origin ? `${two(pieces.indexOf(origin) + 1)} of ${two(pieces.length)}` : '';

  return (
    <Dialog
      open={open}
      // Escape, or the dialog closed by the platform: leave by the address,
      // which is what actually closes it
      onClose={() => route.origin !== null && close()}
      labelledBy="findSimilarTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-x-hidden overflow-y-auto bg-paper p-0 backdrop:bg-transparent motion-safe:open:animate-fade-in"
    >
      {open && origin && session && (
        <div ref={dialogRef} className="relative min-h-full">
          {/* stays at the top on the paper's own colour, so the sheet scrolls under it */}
          <div className="sticky top-0 z-20 -mb-16 flex h-16 items-center justify-end bg-paper px-page-x">
            <Button variant="text" className={TAP} onClick={close}>
              Close &times;
            </Button>
          </div>
          <div key={route.step} className="min-h-full motion-safe:animate-rise-in">
            {route.step === 'preferences' ? (
              <FindSimilarPreferences
                origin={origin}
                place={place}
                drawnTo={session.drawnTo}
                note={session.note}
                onToggle={(signal: PreferenceSignal) =>
                  update((s) => ({
                    drawnTo: s.drawnTo.includes(signal)
                      ? s.drawnTo.filter((x) => x !== signal)
                      : [...s.drawnTo, signal],
                  }))
                }
                onNote={(note) => update(() => ({ note }))}
                onNext={route.toPieces}
                onBack={route.back}
              />
            ) : (
              <FindSimilarPieces
                origin={origin}
                pieces={pieces}
                pool={suggestionPool(pieces, session)}
                page={session.page}
                kept={session.kept}
                setAside={session.setAside}
                drawnTo={session.drawnTo}
                note={session.note.trim()}
                onKeep={(id) =>
                  update((s) => ({ kept: s.kept.includes(id) ? s.kept.filter((x) => x !== id) : [...s.kept, id] }))
                }
                onSetAside={(id) => update((s) => ({ setAside: [...s.setAside, id], kept: s.kept.filter((x) => x !== id) }))}
                onRestore={() => update(() => ({ setAside: [] }))}
                onPage={(page) => update(() => ({ page }))}
                onBack={route.back}
                onContinue={() => onContinue(toConsultation(session))}
              />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
