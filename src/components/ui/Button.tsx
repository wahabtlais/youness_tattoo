import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

/**
 * - line:    the editorial call to action - a burgundy rule that lengthens on
 *            hover/focus, then mono caps ("Ask Younes", "Start a consultation")
 * - text:    a quiet control (Close, Prev, Next)
 * - outline: a framed control for forms
 * No filled, rounded or shadowed buttons: this is print, not an app.
 */
type Variant = 'line' | 'text' | 'outline';

const VARIANTS: Record<Variant, string> = {
  line: 'group inline-flex items-center gap-4 py-2 text-ink',
  text: 'opacity-70 transition-opacity duration-(--duration-fast) ease-editorial hover:opacity-100 focus-visible:opacity-100',
  outline:
    'border border-rule px-4 py-3 whitespace-nowrap text-ink transition-colors duration-(--duration-fast) ease-editorial hover:border-ink disabled:text-ink-muted disabled:hover:border-rule',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'line', type = 'button', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('type-label disabled:cursor-not-allowed disabled:opacity-60', VARIANTS[variant], className)}
      {...rest}
    >
      {variant === 'line' && (
        <span
          aria-hidden="true"
          className="h-px w-[2.4em] origin-right bg-burgundy transition-[scale] duration-(--duration-slow) ease-editorial group-hover:scale-x-160 group-focus-visible:scale-x-160 motion-reduce:transition-none"
        />
      )}
      {children}
    </button>
  );
}
