import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * The visible mark on fictional content - framed, burgundy, mono - so demo
 * records are never mistaken for real ones. `inline` is the short form set
 * beside a title or a date. `onInk`: in an ink chapter, the light burgundy
 * (the deep one can't be read on ink).
 */
export function DemoNotice({ children, inline, onInk, className, id }: { children?: ReactNode; inline?: boolean; onInk?: boolean; className?: string; id?: string }) {
  const tone = onInk ? 'border-burgundy-light text-burgundy-light' : 'border-burgundy text-burgundy';
  if (inline)
    return (
      <span id={id} className={cx('type-meta leading-normal', tone, className)}>
        {children ?? 'Fictional example'}
      </span>
    );
  return (
    <p id={id} className={cx('w-fit border px-3 py-2 type-meta leading-normal', tone, className)}>
      {children ?? 'Demo content — fictional examples'}
    </p>
  );
}
