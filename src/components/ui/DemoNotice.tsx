import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * The visible mark on fictional content - framed, burgundy, mono - so demo
 * records are never mistaken for real ones. `inline` is the short form set
 * beside a title or a date.
 */
export function DemoNotice({ children, inline, className, id }: { children?: ReactNode; inline?: boolean; className?: string; id?: string }) {
  if (inline)
    return (
      <span id={id} className={cx('type-meta leading-normal text-burgundy', className)}>
        {children ?? 'Fictional example'}
      </span>
    );
  return (
    <p id={id} className={cx('w-fit border border-burgundy px-3 py-2 type-meta leading-normal text-burgundy', className)}>
      {children ?? 'Demo content — fictional examples'}
    </p>
  );
}
