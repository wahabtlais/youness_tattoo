import { useRef, useState } from 'react';
import type { PreferenceSignal } from '../../domain/consultation';
import type { TattooWork } from '../../domain/work';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { preferenceLabel, suggestionPage, TAP } from './findSimilarSession';

interface FindSimilarPiecesProps {
  origin: TattooWork;
  /** the archive, for numbering ("05 of 08") */
  pieces: TattooWork[];
  /** what to suggest: the archive minus the origin and what was set aside */
  pool: TattooWork[];
  page: number;
  kept: string[];
  setAside: string[];
  drawnTo: PreferenceSignal[];
  note: string;
  onKeep: (id: string) => void;
  onSetAside: (id: string) => void;
  onRestore: () => void;
  onPage: (page: number) => void;
  /** back to the question */
  onBack: () => void;
  onContinue: () => void;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Step 2: more of Younes's work beside the piece they started from. Keep
 * what speaks to you, set aside what doesn't, ask for something different;
 * what is kept goes on to the consultation with the first piece.
 */
export function FindSimilarPieces({
  origin,
  pieces,
  pool,
  page,
  kept,
  setAside,
  drawnTo,
  note,
  onKeep,
  onSetAside,
  onRestore,
  onPage,
  onBack,
  onContinue,
}: FindSimilarPiecesProps) {
  const number = (id: string) => two(pieces.findIndex((p) => p.id === id) + 1);
  const byId = (id: string) => pieces.find((p) => p.id === id)!;
  const { items, at, pages } = suggestionPage(pool, page);
  const listRef = useRef<HTMLUListElement>(null);
  const [said, setSaid] = useState('');

  const keep = (piece: TattooWork) => {
    const was = kept.includes(piece.id);
    onKeep(piece.id);
    const total = 1 + kept.length + (was ? -1 : 1);
    setSaid(`${was ? 'Removed' : 'Kept'} ${piece.title} ${number(piece.id)}. ${total} ${total === 1 ? 'reference' : 'references'}.`);
  };
  const setAsideOne = (piece: TattooWork) => {
    onSetAside(piece.id);
    setSaid(`Set aside ${piece.title} ${number(piece.id)}.`);
    // its controls are gone: keep the keyboard in the list
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('button')?.focus());
  };
  const references = 1 + kept.length;

  return (
    <div className="mx-auto grid w-full max-w-page gap-[clamp(1.75rem,4vw,3rem)] px-page-x pt-20 pb-36 desktop:grid-cols-[17rem_minmax(0,1fr)] desktop:gap-[clamp(3rem,5vw,5rem)] desktop:pb-14">
      {/* what they started from and what they said - and, on wide screens, what they're taking */}
      <aside className="desktop:sticky desktop:top-20 desktop:self-start">
        <div className="flex items-start gap-4 desktop:block">
          <span className="block w-20 shrink-0 border border-rule bg-paper-light p-1.5 desktop:w-full desktop:p-2.5">
            <ResponsiveImage
              image={origin.image}
              alt={origin.alt}
              sizes="(max-width: 1099px) 80px, 272px"
              className="block h-auto w-full desktop:max-h-[38vh] desktop:object-contain"
            />
          </span>
          <div className="min-w-0 desktop:mt-3">
            <p className="type-meta text-ink-soft">Starting from</p>
            <p className="mt-1 font-serif text-lede">
              {origin.title} <span className="text-burgundy">{number(origin.id)}</span>
            </p>
            <p className="mt-3 text-micro leading-copy text-ink-soft">
              {drawnTo.length ? (
                <>Drawn to {drawnTo.map(preferenceLabel).join(' · ').toLowerCase()}</>
              ) : (
                'No answer yet'
              )}
              {note && <span className="block font-serif text-body italic">“{note}”</span>}
            </p>
            <Button variant="text" className={cx(TAP, 'mt-1 desktop:py-1.5')} onClick={onBack}>
              Change
            </Button>
          </div>
        </div>

        <div className="mt-8 hidden border-t border-rule pt-5 desktop:block">
          <References origin={origin} kept={kept} byId={byId} number={number} onRemove={onKeep} />
          <p className="mt-7 text-micro leading-copy text-ink-soft">
            These go to the consultation with your answers.
          </p>
          <Button className="mt-2" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </aside>

      <section aria-labelledby="findSimilarTitle">
        <p className="type-eyebrow text-burgundy">Find similar · 2 of 2</p>
        <h2 id="findSimilarTitle" tabIndex={-1} className="mt-4 type-heading text-headline outline-none">
          More of Younes’s work.
        </h2>
        <p className="mt-4 max-w-measure text-body leading-copy text-ink-soft">
          Keep the pieces that speak to you and set aside the rest. They come from Younes’s archive as it is —
          not matched to your answers yet. Younes will see what you chose.
        </p>

        {items.length > 0 ? (
          <ul
            ref={listRef}
            key={`${at}-${setAside.length}`}
            className="mt-8 grid grid-cols-2 gap-x-[clamp(1rem,2.5vw,2rem)] gap-y-8 tablet:grid-cols-4 motion-safe:animate-fade-in"
          >
            {items.map((piece) => {
              const isKept = kept.includes(piece.id);
              return (
                <li key={piece.id}>
                  {/* the print itself is a large target for pointer and touch; the
                      Keep control below is the same action for the keyboard */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => keep(piece)}
                    className={cx(
                      'block w-full border bg-paper-light p-1.5 transition-colors duration-(--duration-fast) ease-editorial',
                      isKept ? 'border-burgundy outline-1 outline-burgundy' : 'border-rule hover:border-ink-soft',
                    )}
                  >
                    <ResponsiveImage
                      image={piece.image}
                      alt=""
                      ratio="4 / 5"
                      sizes="(max-width: 699px) 45vw, (max-width: 1099px) 22vw, 220px"
                    />
                  </button>
                  <p className="mt-2.5 flex items-baseline justify-between gap-2 type-meta">
                    <span className={isKept ? 'text-burgundy' : 'text-ink-soft'}>
                      {number(piece.id)} {isKept && '· Kept'}
                    </span>
                    {isKept && (
                      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 text-burgundy">
                        <path d="M2.2 6.4 4.9 9 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4">
                    <Button
                      variant="text"
                      aria-label={
                        isKept
                          ? `Remove ${piece.title} ${number(piece.id)} from your references`
                          : `Keep ${piece.title} ${number(piece.id)} for the consultation`
                      }
                      onClick={() => keep(piece)}
                      className={cx(TAP, 'desktop:py-1.5')}
                    >
                      {isKept ? 'Remove' : 'Keep'}
                    </Button>
                    {!isKept && (
                      <Button
                        variant="text"
                        aria-label={`Not for me: set aside ${piece.title} ${number(piece.id)}`}
                        onClick={() => setAsideOne(piece)}
                        className={cx(TAP, 'desktop:py-1.5')}
                      >
                        Not for me
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-8 border-t border-rule pt-6 font-serif text-lede text-ink-soft italic">
            You’ve set aside everything else in the archive.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-rule pt-5">
          {pages > 1 && (
            <Button variant="text" className={TAP} onClick={() => onPage(at + 1)}>
              Show me something different
            </Button>
          )}
          {setAside.length > 0 && (
            <Button variant="text" className={TAP} onClick={onRestore}>
              Bring back {setAside.length === 1 ? 'the one' : `the ${setAside.length}`} set aside
            </Button>
          )}
          <span className="type-meta text-ink-soft">
            {pages > 1 ? `${at + 1} / ${pages}` : `${pool.length} in the archive`}
          </span>
        </div>
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </section>

      {/* small and medium screens: what they're taking, always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper px-page-x py-3 desktop:hidden">
        <div className="mx-auto flex max-w-page items-center gap-4">
          <ul className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" aria-label="Your references">
            {[origin.id, ...kept].map((id) => (
              <li key={id} className="w-8 shrink-0 border border-rule bg-paper-light p-0.5">
                <ResponsiveImage image={byId(id).image} alt={`${byId(id).title} ${number(id)}`} ratio="4 / 5" sizes="32px" />
              </li>
            ))}
            <li className="ml-2 type-meta whitespace-nowrap text-ink-soft">
              {references} {references === 1 ? 'reference' : 'references'}
            </li>
          </ul>
          <Button onClick={onContinue} className={cx(TAP, 'shrink-0')}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

/** the references going to the consultation: the piece they started from, then what they kept */
function References({
  origin,
  kept,
  byId,
  number,
  onRemove,
}: {
  origin: TattooWork;
  kept: string[];
  byId: (id: string) => TattooWork;
  number: (id: string) => string;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <p className="type-meta text-ink">
        Your references <span className="text-ink-soft">· {1 + kept.length}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        <li className="flex items-center gap-3">
          <span className="w-9 shrink-0 border border-burgundy bg-paper-light p-0.5">
            <ResponsiveImage image={origin.image} alt="" ratio="4 / 5" sizes="36px" />
          </span>
          <span className="type-meta text-ink">
            {number(origin.id)} <span className="text-ink-soft">· Starting piece</span>
          </span>
        </li>
        {kept.map((id) => (
          <li key={id} className="flex items-center gap-3">
            <span className="w-9 shrink-0 border border-rule bg-paper-light p-0.5">
              <ResponsiveImage image={byId(id).image} alt="" ratio="4 / 5" sizes="36px" />
            </span>
            <span className="type-meta text-ink">{number(id)}</span>
            <Button
              variant="text"
              className={cx(TAP, 'ml-auto desktop:py-1.5')}
              aria-label={`Remove ${byId(id).title} ${number(id)} from your references`}
              onClick={() => onRemove(id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {kept.length === 0 && (
        <p className="mt-3 text-micro leading-copy text-ink-soft">Keep pieces to add them here.</p>
      )}
    </>
  );
}
