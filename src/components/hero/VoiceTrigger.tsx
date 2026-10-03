import type { CSSProperties } from 'react';

interface VoiceTriggerProps {
  /** opens the consultation shell; the real voice flow plugs in there later */
  onActivate?: () => void;
}

const RING_R = 31;
/** resting heights of the waveform bars either side of the name (0..1) */
const BARS = [0.35, 0.7, 1, 0.55, 0.8];

function Wave({ side }: { side: 'l' | 'r' }) {
  const bars = side === 'l' ? BARS : [...BARS].reverse();
  return (
    <span className={`voice__wave voice__wave--${side}`} aria-hidden="true">
      {bars.map((h, i) => (
        <i key={i} style={{ '--h': h, '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}

/**
 * Entry point for the future "Ask Younes" voice consultation. Built to read
 * as a physical dial printed on the page rather than a chat bubble: at rest
 * the lines either side of the name are flat (silence); on hover/focus they
 * become a small waveform and the burgundy trace draws round the dial.
 * No voice functionality yet - see ConsultationPanel.
 */
export function VoiceTrigger({ onActivate }: VoiceTriggerProps) {
  return (
    <button
      type="button"
      className="voice unstyled"
      onClick={onActivate}
      aria-label="Ask Younes - voice consultation, arriving soon"
    >
      <span className="voice__dial" aria-hidden="true">
        <span className="voice__echo" />
        <svg className="voice__ring" viewBox="0 0 66 66">
          <circle className="voice__track" cx="33" cy="33" r={RING_R} />
          <circle className="voice__trace" cx="33" cy="33" r={RING_R} pathLength={100} />
          <line className="voice__tick" x1="33" y1="0" x2="33" y2="4" />
        </svg>
        <svg className="voice__mic" viewBox="0 0 24 24">
          <rect className="voice__capsule" x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" />
        </svg>
      </span>
      <span className="voice__label">
        <span className="voice__row">
          <Wave side="l" />
          <span className="voice__name">Ask Younes</span>
          <Wave side="r" />
        </span>
        <span className="voice__meta">
          <span>Voice consultation</span>
          <span>Arriving soon</span>
        </span>
      </span>
    </button>
  );
}
