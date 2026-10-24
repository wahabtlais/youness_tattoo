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
  /** a one-line field's kind: email and tel bring the right keyboard */
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  /** says "required" beside the label (the few fields that must be filled) */
  required?: boolean;
  /** what's wrong with the value, shown under the field and read with it */
  error?: string;
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
  type = 'text',
  autoComplete,
  required,
  error,
}: TextFieldProps) {
  const id = useId();
  const field = 'mt-2.5 block w-full border border-rule bg-paper px-3.5 py-3 text-body leading-copy text-ink placeholder:text-ink-soft';
  return (
    <div className={className}>
      <label htmlFor={id} className="block">
        {label}
        {optional && <span className="type-meta whitespace-nowrap text-ink-soft"> · optional</span>}
        {required && <span className="type-meta whitespace-nowrap text-burgundy"> · required</span>}
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
          type={type}
          value={value}
          maxLength={200}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cx(field, error && 'border-burgundy')}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-micro leading-copy text-burgundy">
          {error}
        </p>
      )}
    </div>
  );
}
