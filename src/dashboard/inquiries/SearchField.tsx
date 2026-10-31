import { useId } from 'react';
import { DashIcon } from '../DashIcon';

/** the Inquiries page's search box: a magnifier, the field, and a clear button once there's text */
export function SearchField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const id = useId();
  return (
    <div className="flex min-h-10 min-w-[min(100%,16rem)] flex-1 items-center gap-2 rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-field) px-2.5 transition-colors hover:border-ink-muted has-[input:focus-visible]:outline-[1.5px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="size-4 shrink-0 text-ink-muted">
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13 13l4 4" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-9 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear the search" className="grid size-7 place-items-center rounded-(--studio-r-sm) text-ink-muted hover:bg-(--studio-hover) hover:text-ink">
          <DashIcon name="close" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
