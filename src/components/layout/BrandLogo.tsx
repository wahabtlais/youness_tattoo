import { cx } from '../../lib/cx';

/**
 * The studio's official logo - the crowned YOUNES TATTOO mark
 * (public/youness_tattoo_logo.png, served as its 640px WebP) - wherever
 * the brand is shown: masthead, menu, footer. Never redrawn as type. One
 * variant exists (ink and burgundy on transparent), so it only sits on the
 * light paper stocks. Size it by height; the width follows its proportions.
 */
export function BrandLogo({ className, alt = 'Younes Tattoo' }: { className?: string; alt?: string }) {
  return (
    <img
      src="/youness_tattoo_logo-640.webp"
      width={640}
      height={222}
      alt={alt}
      decoding="async"
      className={cx('block w-auto max-w-none', className)}
    />
  );
}
