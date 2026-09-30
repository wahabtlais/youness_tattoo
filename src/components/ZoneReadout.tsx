import type { RevealZone } from '../data/zones';

interface ZoneReadoutProps {
  zone: RevealZone | null;
}

export function ZoneReadout({ zone }: ZoneReadoutProps) {
  return (
    <div className="zone" aria-live="polite">
      {zone ? (
        <>
          {zone.title}
          <small>{zone.subtitle}</small>
        </>
      ) : (
        <small>Move to reveal</small>
      )}
    </div>
  );
}
