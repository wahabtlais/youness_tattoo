import { useEffect, useRef, useState } from 'react';
import type { ConsultationSummary } from '../../domain/consultation';
import { useWork } from '../../hooks/useWork';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';
import { ChoiceGroup } from './ChoiceGroup';
import { ConsultationReferences } from './ConsultationReferences';
import { ConsultationDone } from './ConsultationDone';
import { ConsultationReview } from './ConsultationReview';
import {
  BODY_AREAS,
  SCALES,
  STEPS,
  TIMEFRAMES,
  TAP,
  withAnswer,
  type ConsultationStep,
  type DraftState,
} from './consultationDraft';

interface ConsultationPanelProps {
  /** the open draft, or null when closed */
  draft: DraftState | null;
  onChange: (change: (draft: DraftState) => DraftState) => void;
  onClose: () => void;
}

/**
 * The guided consultation (docs/UX_FLOWS.md): the idea, placement and
 * scale, timing and anything else, then a review the client can edit, and
 * an honest close - the draft is ready, nothing has been sent. One question
 * or group of questions per step; every answer optional.
 */
export function ConsultationPanel({ draft, onChange, onClose }: ConsultationPanelProps) {
  const work = useWork();
  const pieces = work.status === 'success' ? work.data : [];
  const sheet = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState('');

  const step = draft?.step;
  const at = STEPS.findIndex((s) => s.step === step);

  // a new step: back to its top, focus on its question (after the dialog's
  // own effect, which opens it and focuses its first control), and say where
  // they are for screen readers
  useEffect(() => {
    if (!step) return;
    const dialog = sheet.current?.closest('dialog');
    if (dialog) dialog.scrollTop = 0;
    sheet.current?.querySelector<HTMLElement>('#consultationTitle')?.focus({ preventScroll: true });
  }, [step]);

  if (!draft) {
    return (
      <Dialog open={false} onClose={onClose} labelledBy="consultationTitle">
        {null}
      </Dialog>
    );
  }

  const { summary, entry } = draft.consultation;
  const answer = <K extends keyof ConsultationSummary>(key: K) => (value: ConsultationSummary[K]) =>
    onChange((d) => withAnswer(d, key, value));
  const go = (to: ConsultationStep, fromReview = false) => {
    const i = STEPS.findIndex((s) => s.step === to);
    if (i >= 0) setSaid(`Step ${i + 1} of ${STEPS.length}: ${STEPS[i].name}`);
    onChange((d) => ({ ...d, step: to, fromReview }));
  };
  const next = () => go(draft.fromReview ? 'review' : STEPS[at + 1].step);
  const back = () => go(STEPS[at - 1].step);
  const fromFindSimilar = entry.from === 'find-similar' ? entry : null;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="consultationTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto bg-transparent px-[4vw] py-[5vh] open:grid backdrop:bg-ink/32 backdrop:backdrop-blur-[3px] motion-safe:open:animate-fade-in motion-safe:backdrop:animate-fade-in"
    >
      <div
        ref={sheet}
        className="relative m-auto w-full max-w-176 border border-rule bg-paper-light px-[clamp(1.25rem,5vw,3.5rem)] py-[clamp(1.5rem,5vw,3rem)] motion-safe:animate-sheet-in"
      >
        <div className="flex items-start justify-between gap-6">
          <p className="pt-1 type-eyebrow text-burgundy">
            Consultation
            {at >= 0 && (
              <span className="text-ink-soft">
                {' '}
                · {at + 1} of {STEPS.length} · {STEPS[at].name}
              </span>
            )}
            {draft.step === 'done' && <span className="text-ink-soft"> · Draft ready</span>}
          </p>
          <Button variant="text" className={cx(TAP, '-mt-2 shrink-0')} onClick={onClose}>
            Close &times;
          </Button>
        </div>
        {/* quiet progress: a hairline per step, burgundy up to this one */}
        {at >= 0 && (
          <ol aria-hidden="true" className="mt-4 grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.step} className={cx('h-px', i <= at ? 'bg-burgundy' : 'bg-rule')} />
            ))}
          </ol>
        )}
        <p className="sr-only" aria-live="polite">
          {said}
        </p>

        <div key={draft.step} className="mt-8 motion-safe:animate-rise-in">
          {draft.step === 'idea' && (
            <>
              <Heading>Let’s talk about your tattoo.</Heading>
              <Lede>Tell me what you’re imagining. You don’t need to have everything figured out yet.</Lede>
              {fromFindSimilar ? (
                <div className="mt-7 border-t border-rule pt-6">
                  <p className="mb-4 type-meta text-ink-soft">You’re starting from</p>
                  <ConsultationReferences entry={fromFindSimilar} pieces={pieces} />
                </div>
              ) : (
                <p className="mt-3 text-micro leading-copy text-ink-soft">No references needed — a few words are enough to begin.</p>
              )}
              <div className="mt-7 flex flex-col gap-6 border-t border-rule pt-6">
                <TextField
                  multiline
                  label={<span className="font-serif text-lede">What would you like to get tattooed?</span>}
                  optional
                  value={summary.concept ?? ''}
                  onChange={answer('concept')}
                  placeholder="A heron among reeds, a line of handwriting, something from the piece above…"
                />
                <TextField
                  multiline
                  rows={4}
                  label={<span className="font-serif text-lede">What’s the idea, story or feeling behind it?</span>}
                  optional
                  value={summary.meaning ?? ''}
                  onChange={answer('meaning')}
                  placeholder="Why it matters to you, or what it should feel like."
                />
              </div>
            </>
          )}

          {draft.step === 'placement' && (
            <>
              <Heading>Where, and how big?</Heading>
              <Lede>Rough is fine — we’ll settle placement and size together.</Lede>
              {fromFindSimilar && <Context entry={fromFindSimilar} pieces={pieces} />}
              <div className="mt-7 flex flex-col gap-8">
                <div>
                  <ChoiceGroup
                    legend="Where on the body?"
                    options={BODY_AREAS}
                    value={summary.bodyArea}
                    onChange={answer('bodyArea')}
                  />
                  <TextField
                    className="mt-4"
                    label={<span className="type-meta text-ink">More precisely</span>}
                    optional
                    hint={summary.bodyArea === 'other' ? 'Tell me where.' : undefined}
                    value={summary.placement ?? ''}
                    onChange={answer('placement')}
                    placeholder="Inner forearm, near the wrist"
                  />
                </div>
                <div>
                  <ChoiceGroup
                    legend="Roughly how big?"
                    options={SCALES}
                    value={summary.scale}
                    onChange={answer('scale')}
                    columns={2}
                  />
                  <TextField
                    className="mt-4"
                    label={<span className="type-meta text-ink">In your words</span>}
                    optional
                    value={summary.size ?? ''}
                    onChange={answer('size')}
                    placeholder="About the size of my palm"
                  />
                </div>
              </div>
            </>
          )}

          {draft.step === 'timing' && (
            <>
              <Heading>Timing, and anything else.</Heading>
              <Lede>There’s no booking here — this just helps me understand where you are.</Lede>
              {fromFindSimilar && <Context entry={fromFindSimilar} pieces={pieces} />}
              <div className="mt-7 flex flex-col gap-8">
                <ChoiceGroup
                  legend="Do you have a timeframe in mind?"
                  options={TIMEFRAMES}
                  value={summary.timing}
                  onChange={answer('timing')}
                  columns={2}
                />
                <TextField
                  multiline
                  rows={4}
                  label={<span className="font-serif text-lede">Anything else I should know?</span>}
                  optional
                  value={summary.notes ?? ''}
                  onChange={answer('notes')}
                  placeholder="A cover-up, a scar to work around, colour or black and grey…"
                />
              </div>
            </>
          )}

          {draft.step === 'review' && (
            <ConsultationReview
              draft={draft}
              pieces={pieces}
              onEdit={(to) => go(to, true)}
              onBack={back}
              onFinish={() => {
                setSaid('Your consultation draft is ready. Nothing has been sent.');
                onChange((d) => ({
                  ...d,
                  step: 'done',
                  fromReview: false,
                  consultation: { ...d.consultation, reviewedAt: new Date().toISOString() },
                }));
              }}
            />
          )}

          {draft.step === 'done' && (
            <ConsultationDone draft={draft} pieces={pieces} onReview={() => go('review')} onClose={onClose} />
          )}

          {(draft.step === 'idea' || draft.step === 'placement' || draft.step === 'timing') && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-rule pt-6">
              {at > 0 ? (
                <Button variant="text" className={TAP} onClick={back}>
                  &larr; Back
                </Button>
              ) : (
                <span />
              )}
              <Button className={TAP} onClick={next}>
                {draft.fromReview ? 'Back to review' : 'Continue'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <h2 id="consultationTitle" tabIndex={-1} className="type-heading text-title italic outline-none">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: string }) {
  return <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">{children}</p>;
}

/** steps after the first keep the references in sight, quietly */
function Context(props: Parameters<typeof ConsultationReferences>[0]) {
  return (
    <div className="mt-5">
      <ConsultationReferences {...props} compact />
    </div>
  );
}
