import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';
import { button } from '../ui';

/**
 * A section of the Overview: a panel with its title, an icon chip in the
 * section's tone (what kind of thing this is - attention, bookings,
 * inquiries), a line of context and, at the right, a control or a way on.
 * A panel with `urgent` set carries a strip of its tone along its top, for
 * the one section that needs eyes first.
 */
export function Panel({
  id,
  title,
  context,
  icon,
  tone = 'neutral',
  status,
  urgent,
  action,
  link,
  className,
  children,
}: {
  id: string;
  title: string;
  context?: ReactNode;
  icon?: DashIconName;
  tone?: 'attention' | 'info' | 'success' | 'danger' | 'accent' | 'neutral' | 'brand';
  /** an inquiry stage's colour instead of a tone */
  status?: string;
  urgent?: boolean;
  /** a control in the header (a period switch) */
  action?: ReactNode;
  link?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      {...(status ? { 'data-status': status } : { 'data-tone': tone })}
      className={cx('studio-card @container relative flex min-w-0 flex-col overflow-hidden p-[clamp(1rem,1.6vw,1.4rem)]', className)}
    >
      {urgent && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.75 bg-(--st-solid)" />}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-(--studio-r-md) bg-(--st-bg) text-(--st-fg)">
              <DashIcon name={icon} className="size-[1.1rem]" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={id} className="type-heading text-[1.0625rem] leading-tight text-ink">
              {title}
            </h2>
            {context && <p className="mt-0.5 text-[0.8125rem] leading-normal text-ink-muted">{context}</p>}
          </div>
        </div>
        {action}
        {link && (
          <Link to={link.to} className={button('ghost', 'sm', 'group -mr-2 gap-1.5 text-burgundy hover:text-burgundy-deep')}>
            {link.label}
            <DashIcon name="arrow" className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
