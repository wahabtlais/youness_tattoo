import type { TattooWork } from '../../domain/work';
import { Button } from '../ui/Button';
import { ConsultationReferences } from './ConsultationReferences';
import { ConsultationCall } from './ConsultationCall';
import { TAP, type DraftState } from './consultationDraft';

interface ConsultationDoneProps {
  draft: DraftState;
  pieces: TattooWork[];
  onReview: () => void;
  onClose: () => void;
}

/**
 * The end of the flow as it exists today, said plainly: the draft is ready
 * and can be looked over again, nothing has been sent, and it lasts only
 * while the page is open. (Sending it to Younes is a later phase.)
 */
export function ConsultationDone({ draft, pieces, onReview, onClose }: ConsultationDoneProps) {
  const { entry } = draft.consultation;
  return (
    <>
      <h2 id="consultationTitle" tabIndex={-1} className="type-heading text-title italic outline-none">
        Your consultation draft is ready.
      </h2>
      <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">
        Everything you’ve told me is gathered here with your references, and you can look it over again whenever
        you like while this page is open.
      </p>
      <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">
        Nothing has been sent yet. Sending it to me directly is still to come — when it is, this is where you’ll
        do it.
      </p>
      {entry.from === 'find-similar' && (
        <div className="mt-7 border-t border-rule pt-6">
          <ConsultationReferences entry={entry} pieces={pieces} compact />
        </div>
      )}
      {entry.from === 'canvas-call' && (
        <div className="mt-7 border-t border-rule pt-6">
          <ConsultationCall entry={entry} />
        </div>
      )}
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-rule pt-6">
        <Button variant="secondary" onClick={onReview}>
          Look it over again
        </Button>
        <Button variant="text" className={TAP} onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
