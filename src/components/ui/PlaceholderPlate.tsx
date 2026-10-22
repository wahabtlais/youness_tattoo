import { cx } from '../../lib/cx';

/**
 * Where an image will go but none exists yet: a ruled plate with crop
 * marks, a construction cross and a mono note - a layout sketch waiting for
 * its picture, never something that could pass for artwork.
 */
export function PlaceholderPlate({ label, ratio = '4 / 5', className }: { label: string; ratio?: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ aspectRatio: ratio }}
      className={cx('relative grid place-items-center border border-rule bg-paper-light', className)}
    >
      <svg aria-hidden="true" viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 size-full stroke-rule" strokeWidth="0.4" fill="none">
        <path d="M0 0L100 125M100 0L0 125" vectorEffect="non-scaling-stroke" />
      </svg>
      {['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'].map((c) => (
        <span key={c} aria-hidden="true" className={cx('absolute size-3 border-burgundy', c)} />
      ))}
      <span aria-hidden="true" className="relative bg-paper-light px-3 py-1.5 text-center type-meta leading-normal text-ink-muted">
        {label}
      </span>
    </div>
  );
}
