import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Button } from './Button';

type Kind = 'loading' | 'empty' | 'error';

const LABEL: Record<Kind, string> = {
  loading: 'Loading',
  empty: 'Nothing here yet',
  error: 'Something went wrong',
};

interface StateMessageProps {
  kind: Kind;
  /** one serif line in the site's voice, e.g. "The archive is being printed." */
  title: string;
  detail?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * The shared loading / empty / error pattern, set like a note on the page
 * rather than a system alert: a mono label, one serif line, an optional way
 * forward. Announced to screen readers (status, or alert for errors).
 * Success needs no message - it is the content itself.
 */
export function StateMessage({ kind, title, detail, action, className }: StateMessageProps) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading' || undefined}
      className={cx('flex flex-col items-center gap-3 py-section text-center', className)}
    >
      <p className={cx('type-meta', kind === 'error' ? 'text-burgundy' : 'text-ink-muted')}>{LABEL[kind]}</p>
      <p className="type-heading max-w-measure text-title">{title}</p>
      {detail && <div className="max-w-measure text-body leading-copy text-ink-soft">{detail}</div>}
      {action && (
        <Button className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
