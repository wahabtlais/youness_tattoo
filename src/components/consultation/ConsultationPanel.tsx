import type { ConsultationEntry } from '../../domain/consultation';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

interface ConsultationPanelProps {
  /** null when closed */
  entry: ConsultationEntry | null;
  onClose: () => void;
}

/**
 * The shell the consultation conversation will live in (docs/UX_FLOWS.md).
 * No API calls, no microphone, no simulated replies yet - the disabled
 * field marks where a message (typed or spoken) will enter the flow.
 */
export function ConsultationPanel({ entry, onClose }: ConsultationPanelProps) {
  return (
    <Dialog
      open={entry !== null}
      onClose={onClose}
      labelledBy="consultationTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center bg-transparent px-[5vw] py-[6vh] open:flex backdrop:bg-ink/32 backdrop:backdrop-blur-[3px] motion-safe:open:animate-fade-in motion-safe:backdrop:animate-fade-in"
    >
      <div className="relative w-full max-w-dialog border border-rule bg-paper-light p-[clamp(2rem,5vw,3rem)] motion-safe:animate-sheet-in">
        <Button variant="text" className="absolute top-5 right-5" onClick={onClose}>
          Close
        </Button>
        <p className="mb-3.5 type-eyebrow text-burgundy">Consultation</p>
        <h2 id="consultationTitle" className="mt-2 mb-4 type-heading text-title italic">
          Tell me what you're thinking.
        </h2>
        <p className="mb-7 text-body leading-copy text-ink-soft">
          This is where the conversation will start — describing what you want, seeing reference pieces, and
          moving toward a booking. Voice consultation is still in development.
        </p>
        <form className="flex gap-3 border-t border-rule pt-6" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            placeholder="Describe what you're thinking…"
            disabled
            aria-label="Describe what you're thinking (coming soon)"
            className="min-w-0 flex-1 border border-rule bg-white px-3.5 py-3 text-body text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button variant="outline" type="submit" disabled>
            Coming soon
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
