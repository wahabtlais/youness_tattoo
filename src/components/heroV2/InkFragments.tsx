import type { CSSProperties } from 'react';

/**
 * Environmental ink - tattoo transfer ink / wet print fragments around the
 * name. NOT the tattoo layer (that arrives as a reveal plate). Hand-placed,
 * deliberately uneven: most cluster where the O and E meet the portrait,
 * a couple escape the word entirely.
 *
 * Coordinates are in em of the giant word, relative to the owning letter's
 * box (0,0 = cap-top left, baseline ~0.67em), so fragments scale, breathe
 * and scroll with the type. `o` is the resting opacity; `dx/dy` (px) the
 * drift when the reveal is active; `d` a stagger delay (s) so they never
 * move together. `m` marks the few that survive on mobile.
 */
type Kind = 'drop' | 'dot' | 'stroke' | 'tick';
interface Fragment {
  kind: Kind;
  x: number;
  y: number;
  s: number;
  rot?: number;
  o: number;
  dx: number;
  dy: number;
  d: number;
  accent?: boolean;
  m?: boolean;
}

const FRAGMENTS: Record<number, Fragment[]> = {
  // O - pooling off its lower-left bowl, one hairline lifting toward him
  1: [
    { kind: 'drop', x: -0.05, y: 0.575, s: 0.034, rot: 205, o: 0.2, dx: -2, dy: 3, d: 0, m: true },
    { kind: 'dot', x: -0.105, y: 0.7, s: 0.016, o: 0.16, dx: -3, dy: 2, d: 0.18 },
    { kind: 'dot', x: 0.07, y: 0.77, s: 0.011, o: 0.13, dx: -1, dy: 3, d: 0.42 },
    { kind: 'stroke', x: 0.6, y: -0.075, s: 0.17, rot: -16, o: 0.17, dx: 2, dy: -2, d: 0.3 },
  ],
  // E - carried off its middle arm toward him; one hairline lands on his forearm
  4: [
    { kind: 'dot', x: -0.035, y: 0.33, s: 0.02, o: 0.2, dx: -3, dy: 0, d: 0.1, accent: true, m: true },
    { kind: 'drop', x: 0.14, y: 0.745, s: 0.026, rot: 170, o: 0.16, dx: -1, dy: 4, d: 0.26 },
    { kind: 'stroke', x: -0.27, y: 0.8, s: 0.12, rot: -9, o: 0.16, dx: -2, dy: 2, d: 0.48 },
    { kind: 'tick', x: 0.52, y: -0.07, s: 0.03, rot: 0, o: 0.14, dx: 2, dy: -3, d: 0.2 },
  ],
  // S - one particle that has left the word altogether
  5: [{ kind: 'dot', x: 0.66, y: -0.13, s: 0.013, o: 0.15, dx: 3, dy: -3, d: 0.55, m: true }],
};

function Shape({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'drop':
      // wet teardrop, slightly irregular
      return (
        <svg viewBox="0 0 10 10">
          <path d="M5.1.2C5.8 2.6 8.7 4.3 8.6 6.7 8.5 8.7 6.9 9.9 4.9 9.8 2.9 9.7 1.4 8.4 1.5 6.5 1.6 4.3 4.5 2.5 5.1.2Z" />
        </svg>
      );
    case 'dot':
      return (
        <svg viewBox="0 0 10 10">
          <path d="M5.3.9C7.6 1.1 9.3 3 9.1 5.3 8.9 7.7 7 9.2 4.7 9.1 2.4 8.9.8 7.1.9 4.8 1.1 2.4 3 .7 5.3.9Z" />
        </svg>
      );
    case 'stroke':
      // hairline pulled from a small bead - a needle leaving the paper
      return (
        <svg viewBox="0 0 100 12" className="ink__line">
          <circle cx="3" cy="7" r="2.2" />
          <path d="M3 7C22 3 41 10 63 5.6S90 5 99 3" />
        </svg>
      );
    case 'tick':
      return (
        <svg viewBox="0 0 10 10" className="ink__line">
          <path d="M1 8.5 4.2 3.4 6 6.2 9 1.2" />
        </svg>
      );
  }
}

export function InkFragments({ letter }: { letter: number }) {
  const list = FRAGMENTS[letter];
  if (!list) return null;
  return (
    <>
      {list.map((f, i) => (
        <i
          key={i}
          className={`ink ink--${f.kind}${f.accent ? ' ink--accent' : ''}${f.m ? '' : ' ink--desktop'}`}
          style={
            {
              '--x': f.x,
              '--y': f.y,
              '--s': f.s,
              '--rot': `${f.rot ?? 0}deg`,
              '--o': f.o,
              '--dx': f.dx,
              '--dy2': f.dy,
              '--d': `${f.d}s`,
            } as CSSProperties
          }
        >
          <Shape kind={f.kind} />
        </i>
      ))}
    </>
  );
}
