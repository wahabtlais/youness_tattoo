import { forwardRef } from 'react';

/**
 * The hero's cursor ring - decorative, never in the way of a click. Hidden
 * until a mouse or pen is over the hero; useRevealEngine writes its
 * position and shows or hides it. The system cursor stays as it is.
 */
export const Cursor = forwardRef<HTMLDivElement>(function Cursor(_, ref) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-15 -mt-1.5 -ml-1.5 size-3 rounded-full border border-ink/50"
      style={{ transform: 'translate3d(-100px, -100px, 0)', opacity: 0 }}
    />
  );
});
