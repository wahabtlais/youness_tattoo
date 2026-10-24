import { cx } from '../lib/cx';

/**
 * The dashboard's controls, as class lists for a <button> or a <Link>:
 * - primary: the one main action in a view, filled with the brand colour
 * - secondary: other actions, outlined on the panel
 * - ghost: quiet actions inside a panel (undo, cancel, hide)
 * - danger: discarding or removing something, in the danger tone
 * Every one has a visible hover, a focus ring and a disabled state.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-(--studio-r-md) font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid';
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
  md: 'h-10 px-4 text-[0.875rem] [&_svg]:size-4',
};
const VARIANTS: Record<Variant, string> = {
  primary: 'border border-transparent bg-(--studio-brand) text-(--studio-on-brand) shadow-(--studio-shadow) hover:bg-(--studio-brand-hover) disabled:hover:bg-(--studio-brand)',
  secondary:
    'border border-(--studio-line-strong) bg-(--studio-raised) text-ink shadow-(--studio-shadow) hover:border-burgundy/60 hover:bg-(--studio-selected) disabled:hover:border-(--studio-line-strong) disabled:hover:bg-(--studio-raised)',
  ghost: 'border border-transparent text-ink-soft hover:bg-(--studio-hover) hover:text-ink disabled:hover:bg-transparent',
  danger: 'border border-transparent text-(--st-fg) hover:bg-(--st-bg) disabled:hover:bg-transparent',
};

/** a control's classes; a danger control also needs data-tone="danger" on it */
export const button = (variant: Variant = 'secondary', size: Size = 'md', className?: string) => cx(BASE, SIZES[size], VARIANTS[variant], className);

/** a text field, select or textarea, set into its panel */
export const field =
  'rounded-(--studio-r-md) border border-(--studio-line-strong) bg-(--studio-field) px-3 text-body text-ink placeholder:text-ink-muted transition-colors hover:border-ink-muted focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus focus-visible:outline-solid';
