interface VoiceTriggerProps {
  /** wired up once the voice assistant exists; a no-op until then */
  onActivate?: () => void;
}

const RING_R = 31;

/**
 * Visual entry point for the future "Ask Younes" voice assistant. Built to
 * read as a physical dial rather than a chat bubble. No voice functionality
 * yet - see ConsultationPanel for where the real flow will plug in.
 */
export function VoiceTrigger({ onActivate }: VoiceTriggerProps) {
  return (
    <button
      type="button"
      className="voice unstyled"
      onClick={onActivate}
      aria-label="Ask Younes - voice assistant, coming soon"
    >
      <span className="voice__dial" aria-hidden="true">
        <svg className="voice__ring" viewBox="0 0 66 66">
          <circle className="voice__track" cx="33" cy="33" r={RING_R} />
          <circle className="voice__trace" cx="33" cy="33" r={RING_R} pathLength={100} />
          <line className="voice__tick" x1="33" y1="0" x2="33" y2="4" />
        </svg>
        <svg className="voice__mic" viewBox="0 0 24 24">
          <rect className="voice__capsule" x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" />
          <path className="voice__wave voice__wave--1" d="M3.6 8.5a9 9 0 0 0 0 6" />
          <path className="voice__wave voice__wave--1" d="M20.4 8.5a9 9 0 0 1 0 6" />
        </svg>
      </span>
      <span className="voice__label">
        <span className="voice__name">Ask Younes</span>
        <span className="voice__meta">
          <span>Voice consultation</span>
          <span>Arriving soon</span>
        </span>
      </span>
    </button>
  );
}
