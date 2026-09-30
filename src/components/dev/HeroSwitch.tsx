import type { HeroVersion } from '../../hooks/useHeroVersion';
import './HeroSwitch.css';

interface HeroSwitchProps {
  value: HeroVersion;
  onChange: (v: HeroVersion) => void;
}

/** Temporary design-time toggle between Hero V1 and Hero V2. */
export function HeroSwitch({ value, onChange }: HeroSwitchProps) {
  return (
    <div className="heroSwitch" role="group" aria-label="Hero version (dev)">
      {(['v1', 'v2'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          Hero {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
