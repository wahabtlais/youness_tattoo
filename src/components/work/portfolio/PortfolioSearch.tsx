import { useId, useRef } from 'react';

interface PortfolioSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** said with the label while the metadata is still demo data */
  sample?: boolean;
}

/**
 * The portfolio's search: a framed field on the lifted paper with a
 * magnifier, a visible label, a placeholder that says what can be found, and
 * a clear button while there is a query (focus returns to the field).
 */
export function PortfolioSearch({ value, onChange, sample }: PortfolioSearchProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="type-meta text-ink-soft">
        Search the portfolio{sample && <span className="text-ink-soft"> · sample metadata</span>}
      </label>
      <div className="group relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-4 size-[1.1rem] -translate-y-1/2 fill-none stroke-ink-soft transition-colors group-focus-within:stroke-burgundy"
          strokeWidth="1.4"
        >
          <circle cx="8.5" cy="8.5" r="5.75" />
          <path d="M12.8 12.8 17.5 17.5" strokeLinecap="round" />
        </svg>
        <input
          ref={input}
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder="Search tattoos, styles, placements…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-13 w-full border border-ink/30 bg-paper-light pr-12 pl-12 font-serif text-[0.95rem] text-ink min-[560px]:text-lede transition-colors outline-none placeholder:text-ink-soft/70 hover:border-ink/60 focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
            aria-label="Clear the search"
            className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center text-ink-soft transition-colors hover:text-burgundy"
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 stroke-current" strokeWidth="1.4">
              <path d="M2 2l8 8M10 2 2 10" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
