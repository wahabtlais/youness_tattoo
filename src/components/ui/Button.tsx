import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { BUTTON_BASE, VARIANTS, type Variant } from './buttonStyles';

/**
 * The site's buttons, by how much they ask for attention:
 * - primary:   the one main action of a place - a solid burgundy block with
 *              paper text ("Start a consultation", "Continue", "Respond to
 *              this call"). Deepens on hover, presses down a pixel.
 * - secondary: an action beside or below a primary one, or a lesser way in
 *              ("Find similar", "Start a general consultation") - an ink
 *              frame that fills with ink on hover.
 * - text:      a quiet control inside a flow (Close, Back, Keep, Change) -
 *              no frame, underlined in burgundy on hover and focus.
 * - line:      the older editorial call to action, a burgundy rule before
 *              caps; kept for compatibility, no longer used for main actions.
 * - outline:   a framed control for forms.
 * Square corners and no shadows: this is print, not an app. Every variant
 * keeps the site's mono caps, and the global focus ring (styles/base.css).
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'line', type = 'button', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(BUTTON_BASE, VARIANTS[variant], className)}
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
