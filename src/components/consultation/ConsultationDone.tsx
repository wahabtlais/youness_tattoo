import type { TattooWork } from '../../domain/work';
import { Button } from '../ui/Button';
import { ConsultationReferences } from './ConsultationReferences';
import { ConsultationCall } from './ConsultationCall';
import type { DraftState } from './consultationDraft';

interface ConsultationDoneProps {
  draft: DraftState;
  pieces: TattooWork[];
  onReview: () => void;
  onClose: () => void;
}

/**
 * The end of the flow, shown only after the studio's server has stored the
 * consultation: it was received, here's its reference, and what happens
 * next - Younes replies; nothing is booked. No promise of an email that
 * may not have been delivered.
 */
export function ConsultationDone({ draft, pieces, onClose }: ConsultationDoneProps) {
  const { entry } = draft.consultation;
  return (
    <>
      <h2 id="consultationTitle" tabIndex={-1} className="type-heading text-title italic outline-none">
        Thank you — I’ve received your idea.
      </h2>
      <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">
        I read every consultation myself, and I’ll reply to {draft.contact.email} to talk it through. Nothing is
        booked yet — that comes once we’ve spoken.
      </p>
      {draft.receipt && (
        <p className="mt-4 type-meta text-ink">
          Your reference: <span className="text-burgundy">{draft.receipt.receiptId}</span>
        </p>
      )}
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
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
