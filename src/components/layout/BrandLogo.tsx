import { cx } from '../../lib/cx';

/**
 * The studio's official logo - the crowned YOUNES TATTOO mark
 * (public/youness_tattoo_logo.png, served as its 640px WebP) - wherever
 * the brand is shown: masthead, menu, footer. Never redrawn as type. Two
 * variants: ink and burgundy for the paper stocks, and (tone="dark") the
 * official white-and-red mark for the ink chapters
 * (public/youness_tattoo_logo_dark.png, its black lifted out by
 * scripts/build-logo-dark.mjs). Size it by height; the width follows.
 */
export function BrandLogo({ className, alt = 'Younes Tattoo', tone = 'light' }: { className?: string; alt?: string; tone?: 'light' | 'dark' }) {
  return (
    <img
      src={tone === 'dark' ? '/youness_tattoo_logo-dark-640.webp' : '/youness_tattoo_logo-640.webp'}
      width={640}
      height={222}
      alt={alt}
      decoding="async"
      className={cx('block w-auto max-w-none', className)}
    />
  );
}
