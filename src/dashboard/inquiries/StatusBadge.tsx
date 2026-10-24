import type { ConsultationStatus } from '../../domain/consultation';
import { cx } from '../../lib/cx';
import { STATUS_LABEL } from '../format';

/**
 * An inquiry's status as a pill in its semantic colour (studio.css,
 * [data-status]): amber for new, blue in review, violet waiting on details,
 * cyan contacted, green accepted, teal booking, a muted green-grey for
 * completed and a restrained rose-grey for declined. Always the word as
 * well as the colour - never colour alone.
 */
export function StatusBadge({ status, size = 'md', className }: { status: ConsultationStatus; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      data-status={status}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-(--st-line) bg-(--st-bg) font-medium leading-none whitespace-nowrap text-(--st-fg)',
        size === 'sm' ? 'h-6 px-2 text-[0.75rem]' : 'h-7 px-2.5 text-[0.8125rem]',
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
      {STATUS_LABEL[status]}
    </span>
  );
}
