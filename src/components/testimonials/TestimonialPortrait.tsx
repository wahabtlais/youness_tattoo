import type { ClientTestimonial, DemoTestimonial } from '../../domain/client';
import { ResponsiveImage } from '../ui/ResponsiveImage';

type Portrait = NonNullable<ClientTestimonial['portrait'] | DemoTestimonial['portrait']>;

/**
 * The small portrait beside a testimonial's name: a client's own photograph
 * (with consent), or - for a fictional entry - a drawn placeholder that
 * can't pass for one: a hairline head-and-shoulders outline in a ruled
 * frame, with the initials and a registration mark, like a layout sketch
 * waiting for its picture.
 */
export function TestimonialPortrait({ portrait }: { portrait: Portrait }) {
  if ('image' in portrait) {
    return (
      <span className="block border border-rule p-0.5">
        <ResponsiveImage image={portrait.image} alt={portrait.alt} ratio="4 / 5" sizes="96px" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="relative block aspect-4/5 border border-rule bg-paper-light">
      <svg viewBox="0 0 40 50" className="absolute inset-0 size-full fill-none stroke-ink-muted" strokeWidth="0.6">
        <circle cx="20" cy="19" r="7.5" />
        <path d="M6 50c0-9.5 6.3-15.5 14-15.5S34 40.5 34 50" />
        {/* construction: the head's centre lines */}
        <path d="M20 8v22M9 19h22" strokeDasharray="1 1.6" className="stroke-rule" />
      </svg>
      <span className="absolute -top-px -right-px size-2 border-t border-r border-burgundy" />
      <span className="absolute top-1 left-1.5 font-mono leading-none text-[0.55rem] tracking-[0.12em] text-ink-soft">
        {portrait.initials}
      </span>
    </span>
  );
}
