import { useEffect, useId, useRef } from 'react';
import { cx } from '../../../lib/cx';

interface FilterMenuProps {
  label: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One filter category as a compact menu: a button that names the category
 * and how many of its values are chosen, opening a small panel of
 * checkboxes (each with how many pieces have it). A disclosure, not an ARIA
 * menu: Tab moves through the checkboxes, Escape or a click outside closes
 * it and focus goes back to its button. Only one is open at a time (the
 * toolbar decides).
 */
export function FilterMenu({ label, options, selected, onToggle, open, onOpenChange }: FilterMenuProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const n = selected.length;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onOpenChange(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={cx(
          'inline-flex min-h-11 items-center gap-2.5 border px-4 type-label transition-colors duration-(--duration-fast)',
          n > 0 ? 'border-burgundy text-burgundy' : 'border-ink/30 text-ink hover:border-ink/60',
          open && 'border-ink bg-paper-light',
        )}
      >
        {label}
        {n > 0 && (
          <span className="grid min-w-5 place-items-center bg-burgundy px-1 text-micro leading-5 text-paper" aria-label={`${n} selected`}>
            {n}
          </span>
        )}
        <svg aria-hidden="true" viewBox="0 0 10 6" className={cx('w-2.5 fill-none stroke-current transition-transform motion-reduce:transition-none', open && 'rotate-180')} strokeWidth="1.3">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <fieldset
          id={id}
          className="absolute top-[calc(100%+0.4rem)] left-0 z-20 grid max-h-[min(22rem,60vh)] w-max min-w-full max-w-[min(20rem,calc(100vw-2*var(--spacing-page-x)))] gap-0.5 overflow-y-auto border border-ink/25 bg-paper-light p-2 motion-safe:animate-fade-in"
        >
          <legend className="sr-only">{label}</legend>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 px-2 hover:bg-paper-deep">
                <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} className="size-4 accent-burgundy" />
                <span className="flex-1 text-body text-ink">{o.label}</span>
                <span className="type-meta text-ink-soft">{o.count}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
