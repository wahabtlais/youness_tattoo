import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  /** the carousel: hovering it, keyboard focus or a playing recording inside it holds the turn */
  regionRef: RefObject<HTMLElement | null>;
  /** off for reduced motion, and while the visitor has stopped it */
  enabled: boolean;
  /** which testimonial is showing - a new one gets its full reading time */
  active: number;
  /** how long the showing one stays, in ms (longer words, longer stay) */
  delay: number;
  /** turn to the next one */
  onAdvance: () => void;
}

/** after the visitor's own touch, click or swipe: leave them be this long */
const GRACE = 15_000;

/**
 * Gentle auto-advance for the testimonial carousel: one timeout, running
 * only while nothing holds it. It holds while a mouse rests on the carousel,
 * while keyboard focus is inside it, while a recording in it plays, while
 * the tab is hidden and while the carousel is off screen; any touch or click
 * inside (arrows, player, a swipe) buys a grace period. Each new testimonial
 * starts its full delay again. Never touches audio.
 */
export function useAutoAdvance({ regionRef, enabled, active, delay, onAdvance }: Options) {
  const advanceRef = useRef(onAdvance);
  useEffect(() => {
    advanceRef.current = onAdvance;
  }, [onAdvance]);
  // why it is held, kept across testimonials (a hover outlasts a turn)
  const holds = useRef(new Set<string>());
  const graceUntil = useRef(0);

  useEffect(() => {
    const region = regionRef.current;
    if (!enabled || !region) return;
    let timer = 0;
    let due = performance.now() + delay;

    const schedule = () => {
      clearTimeout(timer);
      timer = 0;
      if (holds.current.size) return;
      const at = Math.max(due, graceUntil.current);
      timer = window.setTimeout(() => {
        if (!holds.current.size) advanceRef.current();
      }, Math.max(0, at - performance.now()));
    };
    const hold = (why: string, on: boolean) => {
      if (on) holds.current.add(why);
      else holds.current.delete(why);
      // let go: whatever is left of this one's time, but never less than a moment
      if (!on && !holds.current.size) due = Math.max(due, performance.now() + 2500);
      schedule();
    };
    const touched = () => {
      graceUntil.current = performance.now() + GRACE;
      schedule();
    };

    const onEnter = (e: PointerEvent) => e.pointerType === 'mouse' && hold('hover', true);
    const onLeave = (e: PointerEvent) => e.pointerType === 'mouse' && hold('hover', false);
    const onFocusIn = (e: FocusEvent) => {
      // keyboard focus only - a clicked arrow keeps focus without being "in" it
      if ((e.target as HTMLElement).matches(':focus-visible')) hold('focus', true);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!region.contains(e.relatedTarget as Node | null)) hold('focus', false);
    };
    // media events don't bubble, but they do pass the region on the way down
    const onPlay = () => hold('audio', true);
    const onStop = () => {
      hold('audio', [...region.querySelectorAll('audio')].some((a) => !a.paused));
      touched();
    };
    const onVisibility = () => hold('hidden', document.hidden);
    const io = new IntersectionObserver(([e]) => hold('offscreen', !e.isIntersecting), { threshold: 0.35 });

    region.addEventListener('pointerenter', onEnter);
    region.addEventListener('pointerleave', onLeave);
    region.addEventListener('pointerdown', touched);
    region.addEventListener('focusin', onFocusIn);
    region.addEventListener('focusout', onFocusOut);
    region.addEventListener('play', onPlay, true);
    region.addEventListener('pause', onStop, true);
    region.addEventListener('ended', onStop, true);
    document.addEventListener('visibilitychange', onVisibility);
    io.observe(region);
    onVisibility();

    return () => {
      clearTimeout(timer);
      io.disconnect();
      region.removeEventListener('pointerenter', onEnter);
      region.removeEventListener('pointerleave', onLeave);
      region.removeEventListener('pointerdown', touched);
      region.removeEventListener('focusin', onFocusIn);
      region.removeEventListener('focusout', onFocusOut);
      region.removeEventListener('play', onPlay, true);
      region.removeEventListener('pause', onStop, true);
      region.removeEventListener('ended', onStop, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, active, delay, regionRef]);
}
