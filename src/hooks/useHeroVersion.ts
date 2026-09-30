import { useState } from 'react';

export type HeroVersion = 'v1' | 'v2';

const KEY = 'younes:hero';

function readInitial(): HeroVersion {
  const param = new URLSearchParams(location.search).get('hero');
  if (param === 'v1' || param === 'v2') return param;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'v1' || stored === 'v2') return stored;
  } catch {
    // storage blocked - fall through to the default
  }
  return 'v2';
}

/**
 * Temporary design-time switch between the original hero and the V2
 * experiment. `?hero=v1|v2` wins, then the last choice in this browser.
 * Not a settings system - delete once a direction is chosen.
 */
export function useHeroVersion(): [HeroVersion, (v: HeroVersion) => void] {
  const [version, setVersion] = useState<HeroVersion>(readInitial);

  function set(v: HeroVersion) {
    setVersion(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // ignore
    }
  }

  return [version, set];
}

/** show the switch in dev, or on any build opened with ?hero= */
export const showHeroSwitch =
  import.meta.env.DEV || new URLSearchParams(location.search).has('hero');
