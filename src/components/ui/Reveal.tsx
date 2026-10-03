import type { ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';
import { cx } from '../../lib/cx';

interface RevealProps {
  className?: string;
  children: ReactNode;
}

/**
 * Content that settles onto the page the first time it scrolls into view:
 * a short rise and fade, once. With reduced motion it is simply there.
 */
export function Reveal({ className, children }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-in={inView}
      className={cx(
        'motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-slow) motion-safe:ease-editorial',
        'motion-safe:data-[in=false]:translate-y-4.5 motion-safe:data-[in=false]:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
