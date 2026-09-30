import { useEffect, useRef } from 'react';
import './ConsultationPanel.css';

interface ConsultationPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Component boundary for the future voice assistant (brief steps 10-11:
 * conversation -> artwork discovery -> consultation -> booking). This pass
 * only builds the shell: no API calls, no microphone access, no simulated
 * replies. The disabled input is a structural placeholder for where a
 * message (typed or eventually spoken) will enter the flow.
 */
export function ConsultationPanel({ open, onClose }: ConsultationPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="consultationScrim" onClick={onClose}>
      <div
        className="consultationPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consultationTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="consultationPanel__close unstyled" onClick={onClose}>
          Close
        </button>
        <span className="kicker">Consultation</span>
        <h3 id="consultationTitle">Tell me what you're thinking.</h3>
        <p>
          This is where the conversation will start — describing what you want, seeing reference pieces, and
          moving toward a booking. Voice consultation is still in development.
        </p>
        <form
          className="consultationPanel__form"
          onSubmit={(e) => e.preventDefault()}
        >
          <input type="text" placeholder="Describe what you're thinking…" disabled aria-label="Describe what you're thinking (coming soon)" />
          <button type="submit" className="unstyled" disabled>
            Coming soon
          </button>
        </form>
      </div>
    </div>
  );
}
