import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import type { DashIconName } from '../dashIcons';

/** nothing to show here: what would be, why it isn't, and a way on if there is one */
export function EmptyState({ icon, title, children, action, className }: { icon: DashIconName; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('grid place-items-center rounded-(--studio-r-md) border border-dashed border-(--studio-line-strong) px-6 py-10 text-center', className)}>
      <div className="max-w-[42ch]">
        <span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-full bg-(--studio-sunken) text-ink-muted">
          <DashIcon name={icon} className="size-5" />
        </span>
        <p className="mt-3 type-heading text-[1.05rem]">{title}</p>
        {children && <div className="mt-1 text-[0.9375rem] leading-snug text-ink-soft">{children}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/**
 * A control for something not connected yet: visibly a button, plainly
 * disabled, with the reason beside it - never a click that pretends.
 */
export function NotConnected({ icon, label, reason }: { icon?: DashIconName; label: string; reason: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled
        title={reason}
        className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-(--studio-r-md) border border-dashed border-(--studio-line-strong) px-4 text-[0.875rem] font-semibold text-ink-muted"
      >
        {icon && <DashIcon name={icon} className="size-4" />}
        {label}
      </button>
      <span className="text-[0.8125rem] text-ink-muted">{reason}</span>
    </span>
  );
}
