import type { FormEvent } from 'react';
import type { PreferenceSignal } from '../../domain/consultation';
import type { TattooWork } from '../../domain/work';
import { Button } from '../ui/Button';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { PREFERENCES, TAP } from './findSimilarSession';

interface FindSimilarPreferencesProps {
  origin: TattooWork;
  /** its place in the archive, e.g. "03 of 08" */
  place: string;
  drawnTo: PreferenceSignal[];
  note: string;
  onToggle: (signal: PreferenceSignal) => void;
  onNote: (note: string) => void;
  onNext: () => void;
  /** back to the piece they started from */
  onBack: () => void;
}

/**
 * Step 1: the piece they started from, large, and one question about it.
 * Every answer is optional - the visitor can go on with none.
 */
export function FindSimilarPreferences({
  origin,
  place,
  drawnTo,
  note,
  onToggle,
  onNote,
  onNext,
  onBack,
}: FindSimilarPreferencesProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div className="mx-auto grid min-h-full w-full max-w-page content-center gap-[clamp(1.75rem,4vw,3rem)] px-page-x pt-20 pb-14 desktop:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] desktop:items-center desktop:gap-[clamp(3rem,7vw,7rem)]">
      {/* a table, so the caption wraps to the photograph's width instead of widening its frame */}
      <figure className="table justify-self-center">
        <span className="block border border-rule bg-paper-light p-[clamp(6px,0.8vw,12px)]">
          <ResponsiveImage
            image={origin.image}
            alt={origin.alt}
            priority
            sizes="(max-width: 1099px) 70vw, 40vw"
            className="block h-auto max-h-[42vh] w-auto max-w-full desktop:max-h-[68vh]"
          />
        </span>
        <figcaption className="table-caption caption-bottom">
          <span className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 type-meta text-ink-soft">
            <span>Starting from</span>
            <span>
              {origin.title} · <span className="text-burgundy">{place}</span>
            </span>
          </span>
        </figcaption>
      </figure>

      <form onSubmit={submit} className="flex flex-col">
        <p className="type-eyebrow text-burgundy">Find similar · 1 of 2</p>
        <h2 id="findSimilarTitle" tabIndex={-1} className="mt-4 type-heading text-headline outline-none">
          What speaks to you about this piece?
        </h2>
        <p className="mt-4 max-w-measure text-body leading-copy text-ink-soft">
          Choose as many as you like, or none. Your answers order the pieces that follow, and Younes sees them too.
        </p>

        <fieldset className="mt-7">
          <legend className="sr-only">What speaks to you about this piece</legend>
          <ul className="grid grid-cols-2 gap-x-6 border-b border-rule">
            {PREFERENCES.map(({ signal, label, hint }) => (
              <li key={signal} className="border-t border-rule">
                <label className="flex min-h-12 cursor-pointer items-start gap-3 py-3 has-checked:text-burgundy">
                  <span className="relative mt-px grid size-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={drawnTo.includes(signal)}
                      onChange={() => onToggle(signal)}
                      className="peer col-start-1 row-start-1 size-full cursor-pointer appearance-none border border-ink-soft bg-paper-light checked:border-burgundy checked:bg-burgundy"
                    />
                    {/* the tick: the selected state never rests on colour alone */}
                    <svg
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      className="pointer-events-none col-start-1 row-start-1 size-full p-0.5 text-paper-light opacity-0 peer-checked:opacity-100"
                    >
                      <path d="M2.2 6.4 4.9 9 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  <span>
                    <span className="block type-label">{label}</span>
                    {hint && <span className="mt-1 block text-micro text-ink-soft">{hint}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label className="mt-7 block">
          <span className="type-meta text-ink">In your own words</span>{' '}
          <span className="type-meta text-ink-soft">· optional</span>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="The way the shading wraps around the arm…"
            className="mt-3 block w-full resize-y border border-rule bg-paper-light px-3.5 py-3 text-body leading-copy text-ink placeholder:text-ink-soft"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button type="submit" variant="primary">
            See more of the work
          </Button>
          <Button variant="text" className={TAP} onClick={onBack}>
            Back to the piece
          </Button>
        </div>
      </form>
    </div>
  );
}
