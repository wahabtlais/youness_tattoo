import type { ReactNode } from 'react';
import type { TattooWork } from '../../domain/work';
import { Button } from '../ui/Button';
import { ConsultationReferences } from './ConsultationReferences';
import { ConsultationCall } from './ConsultationCall';
import {
  BODY_AREAS,
  labelOf,
  SCALES,
  TAP,
  text,
  TIMEFRAMES,
  type ConsultationStep,
  type DraftState,
} from './consultationDraft';

interface ConsultationReviewProps {
  draft: DraftState;
  pieces: TattooWork[];
  /** go to a step to change it (it leads back here) */
  onEdit: (step: ConsultationStep) => void;
  onBack: () => void;
  onFinish: () => void;
}

/**
 * Everything the client has said, laid out to read rather than to check:
 * their references, the idea, placement and scale, timing, anything else.
 * Each part can be changed in place; unanswered parts say so gently.
 */
export function ConsultationReview({ draft, pieces, onEdit, onBack, onFinish }: ConsultationReviewProps) {
  const { summary, entry } = draft.consultation;
  const where = joinAnswer(labelOf(BODY_AREAS, summary.bodyArea), text(summary.placement));
  const size = joinAnswer(labelOf(SCALES, summary.scale), text(summary.size));
  const timing = labelOf(TIMEFRAMES, summary.timing);

  return (
    <>
      <h2 id="consultationTitle" tabIndex={-1} className="type-heading text-title italic outline-none">
        Here’s your idea.
      </h2>
      <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">
        Look it over, and change anything that isn’t quite right.
      </p>

      <dl className="mt-7 border-b border-rule">
        {entry.from === 'find-similar' && (
          <Part term="Your references" hint="Chosen in Find similar — close this to change them there.">
            <ConsultationReferences entry={entry} pieces={pieces} />
          </Part>
        )}
        {entry.from === 'canvas-call' && (
          <Part term="The call" hint="Opened from the call’s page.">
            <ConsultationCall entry={entry} />
          </Part>
        )}
        <Part term="The idea" onEdit={() => onEdit('idea')} editLabel="Change the idea">
          {text(summary.concept) || text(summary.meaning) ? (
            <>
              {text(summary.concept) && <p className="font-serif text-lede">{text(summary.concept)}</p>}
              {text(summary.meaning) && (
                <p className="mt-2 font-serif text-lede text-ink-soft italic">{text(summary.meaning)}</p>
              )}
            </>
          ) : (
            <Unanswered />
          )}
        </Part>
        <Part term="Placement and scale" onEdit={() => onEdit('placement')} editLabel="Change placement and scale">
          {where || size ? (
            <ul className="text-body leading-copy text-ink">
              {where && <li>{where}</li>}
              {size && <li>{size}</li>}
            </ul>
          ) : (
            <Unanswered />
          )}
        </Part>
        <Part term="Timing" onEdit={() => onEdit('timing')} editLabel="Change the timing">
          {timing ? <p className="text-body text-ink">{timing}</p> : <Unanswered />}
        </Part>
        <Part term="Anything else" onEdit={() => onEdit('timing')} editLabel="Change anything else">
          {text(summary.notes) ? <p className="text-body leading-copy text-ink">{text(summary.notes)}</p> : <Unanswered />}
        </Part>
      </dl>

      <p className="mt-8 text-micro leading-copy text-ink-soft">
        Finishing keeps this draft here while the page is open. Nothing is sent yet.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <Button variant="text" className={TAP} onClick={onBack}>
          &larr; Back
        </Button>
        <Button variant="primary" onClick={onFinish}>
          Finish consultation
        </Button>
      </div>
    </>
  );
}

/** "Forearm — inner, near the wrist" */
function joinAnswer(choice: string | undefined, words: string | undefined) {
  return [choice, words].filter(Boolean).join(' — ') || undefined;
}

function Part({
  term,
  hint,
  onEdit,
  editLabel,
  children,
}: {
  term: string;
  hint?: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-2 border-t border-rule py-5 tablet:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <dt className="type-meta text-ink-soft">
        {term}
        {hint && <span className="mt-2 block text-micro leading-copy normal-case tracking-normal">{hint}</span>}
      </dt>
      <dd className="min-w-0">{children}</dd>
      {onEdit && (
        <dd className="tablet:text-right">
          <Button variant="text" className={TAP} aria-label={editLabel} onClick={onEdit}>
            Change
          </Button>
        </dd>
      )}
    </div>
  );
}

function Unanswered() {
  return <p className="text-body text-ink-soft">Not answered — that’s fine.</p>;
}
