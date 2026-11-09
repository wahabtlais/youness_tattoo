import { useEffect, useState } from 'react';

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Runs `task` once the page has loaded and the browser has a quiet moment
 * (or after `timeout` ms of idle waiting at most): for work and downloads
 * that must not compete with the first paint - decorative images, code for
 * things opened later. Returns a cancel function.
 */
export function whenIdleAfterLoad(task: () => void, timeout = 2000): () => void {
  const w = window as IdleWindow;
  let idle = 0;
  let cancelled = false;
  const schedule = () => {
    if (cancelled) return;
    if (w.requestIdleCallback) idle = w.requestIdleCallback(task, { timeout });
    else idle = window.setTimeout(task, 200);
  };
  if (document.readyState === 'complete') schedule();
  else addEventListener('load', schedule, { once: true });
  return () => {
    cancelled = true;
    removeEventListener('load', schedule);
    if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
    else clearTimeout(idle);
  };
}

/**
 * Resolves at a quiet moment: nobody has scrolled (wheel, touch or
 * scrollbar) for `quietMs`, and the browser is idle. For heavy one-off work
 * split into steps, so no step lands in the middle of a scroll. Gives up
 * waiting after `maxMs` - the work happens anyway.
 */
export function whenQuiet(quietMs = 250, maxMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const events = ['scroll', 'wheel', 'touchmove'] as const;
    let timer = 0;
    let cancelIdle = () => {};
    const finish = () => {
      clearTimeout(timer);
      clearTimeout(cap);
      for (const e of events) removeEventListener(e, restart, true);
      cancelIdle = whenIdleAfterLoad(resolve, 500);
    };
    const restart = () => {
      cancelIdle();
      clearTimeout(timer);
      timer = window.setTimeout(finish, quietMs);
    };
    const cap = window.setTimeout(finish, maxMs);
    for (const e of events) addEventListener(e, restart, { passive: true, capture: true });
    restart();
  });
}

/**
 * true once the first frame has been painted and the browser has had a
 * moment (at most `timeout` ms later) - not waiting for every image to load.
 * For content below the fold: the first paint never waits for it, and it is
 * there long before anyone scrolls to it. `now` skips the wait.
 */
export function useAfterFirstPaint(now = false, timeout = 1000): boolean {
  const [ready, setReady] = useState(now);
  useEffect(() => {
    if (ready) return;
    const w = window as IdleWindow;
    let idle = 0;
    // after the frame that paints the page, then at an idle moment
    const raf = requestAnimationFrame(() => {
      idle = w.requestIdleCallback ? w.requestIdleCallback(() => setReady(true), { timeout }) : window.setTimeout(() => setReady(true), 50);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, [ready, timeout]);
  return ready;
}

/** true once the page has loaded and the browser has had a quiet moment */
export function useAfterLoad(timeout?: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => whenIdleAfterLoad(() => setReady(true), timeout), [timeout]);
  return ready;
}
