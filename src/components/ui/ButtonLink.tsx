import type { ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { cx } from '../../lib/cx';
import { BUTTON_BASE, VARIANTS, type Variant } from './buttonStyles';

/**
 * A link to another page that should read as a button - the same variants
 * as Button (buttonStyles), on a router Link, so it is still a link: it
 * navigates, opens in a new tab, and is announced as one. Defaults to
 * `navigate`, the framed button for an important way to another page. `arrow` adds a
 * small → that steps forward on hover and keyboard focus (still under
 * reduced motion).
 */
export function ButtonLink({
  to,
  variant = 'navigate',
  arrow,
  className,
  children,
}: {
  to: To;
  variant?: Variant;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cx('group', BUTTON_BASE, VARIANTS[variant], className)}>
      {children}
      {arrow && (
        <span
          aria-hidden="true"
          className="transition-transform duration-(--duration-fast) ease-editorial group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-focus-visible:translate-x-0"
        >
          &rarr;
        </span>
      )}
    </Link>
  );
}
