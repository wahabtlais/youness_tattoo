import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface TextFieldProps {
  /** the question or name of the field */
  label: ReactNode;
  /** says "optional" beside the label */
  optional?: boolean;
  /** a line of help under the label, read with the field */
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** several lines (a textarea) or one */
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * A labelled text field on the paper: a hairline frame, mono text, the
 * global focus ring. Nothing is ever required here - fields say when they
 * are optional rather than marking what is mandatory.
 */
export function TextField({
  label,
  optional,
  hint,
  value,
  onChange,
  multiline,
  rows = 3,
  placeholder,
  maxLength = 1200,
  className,
}: TextFieldProps) {
  const id = useId();
  const field = 'mt-2.5 block w-full border border-rule bg-paper px-3.5 py-3 text-body leading-copy text-ink placeholder:text-ink-soft';
  return (
    <div className={className}>
      <label htmlFor={id} className="block">
        {label}
        {optional && <span className="type-meta whitespace-nowrap text-ink-soft"> · optional</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-micro leading-copy text-ink-soft">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cx(field, 'resize-y')}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={200}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      )}
    </div>
  );
}
