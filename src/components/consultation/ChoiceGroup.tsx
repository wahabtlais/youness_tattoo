import { useId } from 'react';
import { cx } from '../../lib/cx';

interface ChoiceGroupProps<T extends string> {
  legend: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** grid columns from tablet up (phones: two, or one for options with hints) */
  columns?: 2 | 3;
}

/**
 * One choice among a few, as hairline rows like Find Similar's - native
 * radios underneath, so arrow keys, focus and screen readers work as they
 * should. The ring fills burgundy and the label turns burgundy when chosen:
 * the chosen state never rests on colour alone.
 */
export function ChoiceGroup<T extends string>({ legend, options, value, onChange, columns = 3 }: ChoiceGroupProps<T>) {
  const name = useId();
  const hints = options.some((o) => o.hint);
  return (
    <fieldset>
      <legend className="font-serif text-lede">{legend}</legend>
      <ul
        className={cx(
          'mt-3 grid gap-x-6 border-b border-rule',
          hints ? 'grid-cols-1' : 'grid-cols-2',
          columns === 3 ? 'tablet:grid-cols-3' : 'tablet:grid-cols-2',
        )}
      >
        {options.map((o) => (
          <li key={o.value} className="border-t border-rule">
            <label className="flex min-h-12 cursor-pointer items-start gap-3 py-3 has-checked:text-burgundy">
              <span className="relative mt-px grid size-4 shrink-0">
                <input
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                  className="peer col-start-1 row-start-1 size-full cursor-pointer appearance-none rounded-full border border-ink-soft bg-paper checked:border-burgundy"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none col-start-1 row-start-1 m-auto size-2 rounded-full bg-burgundy opacity-0 peer-checked:opacity-100"
                />
              </span>
              <span>
                <span className="block type-label">{o.label}</span>
                {o.hint && <span className="mt-1 block text-micro text-ink-soft">{o.hint}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
