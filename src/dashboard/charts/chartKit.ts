import { useCallback, useState, type KeyboardEvent } from 'react';

/**
 * What the dashboard's charts share: a cursor - the data point being read,
 * by pointer or by keyboard (arrow keys, Home, End). The charts themselves
 * are laid out by the browser (flex and percentages, no measuring) and
 * themed by the --studio-* variables, so light and dark need no code.
 */

/**
 * Which point is being read. Pointer movement sets it, leaving clears it;
 * on keyboard focus it starts at the latest point and the arrows move it.
 * `keyboard` tells the chart to announce the value (a live region).
 */
export function useChartCursor(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const move: Record<string, (i: number) => number> = {
        ArrowRight: (i) => Math.min(count - 1, i + 1),
        ArrowDown: (i) => Math.min(count - 1, i + 1),
        ArrowLeft: (i) => Math.max(0, i - 1),
        ArrowUp: (i) => Math.max(0, i - 1),
        Home: () => 0,
        End: () => count - 1,
      };
      const f = move[e.key];
      if (!f) return;
      e.preventDefault();
      setKeyboard(true);
      setActive((i) => f(i ?? count - 1));
    },
    [count],
  );
  return {
    active,
    keyboard,
    point: (i: number) => {
      setKeyboard(false);
      setActive(i);
    },
    leave: () => setActive(null),
    focusProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => {
        setKeyboard(true);
        setActive((i) => i ?? count - 1);
      },
      onBlur: () => setActive(null),
    },
  };
}
