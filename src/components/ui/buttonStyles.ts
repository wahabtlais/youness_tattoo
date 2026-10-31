export const BUTTON_BASE = 'type-label disabled:cursor-not-allowed disabled:opacity-60';

/** the button variants' classes, shared by Button and ButtonLink (see Button for what each is for) */
export type Variant = 'primary' | 'secondary' | 'navigate' | 'text' | 'line' | 'outline';

export const VARIANTS: Record<Variant, string> = {
  primary:
    'inline-flex min-h-12 items-center justify-center gap-3 border border-burgundy bg-burgundy px-6 py-3 text-paper transition-[background-color,border-color,translate] duration-(--duration-fast) ease-editorial hover:border-burgundy-deep hover:bg-burgundy-deep active:translate-y-px disabled:border-rule disabled:bg-paper-deep disabled:text-ink-soft disabled:hover:bg-paper-deep motion-reduce:active:translate-y-0',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-3 border border-ink/55 px-5 py-2.5 text-ink transition-[background-color,border-color,color,translate] duration-(--duration-fast) ease-editorial hover:border-ink hover:bg-ink hover:text-paper active:translate-y-px disabled:hover:bg-transparent disabled:hover:text-ink motion-reduce:active:translate-y-0',
  /** secondary in a full-ink frame: an important way to another page ("Read the journal", "All canvas calls") */
  navigate:
    'inline-flex min-h-11 items-center justify-center gap-3 border border-ink px-5 py-2.5 text-ink transition-[background-color,border-color,color,translate] duration-(--duration-fast) ease-editorial hover:border-ink hover:bg-ink hover:text-paper active:translate-y-px disabled:hover:bg-transparent disabled:hover:text-ink motion-reduce:active:translate-y-0',
  text: 'text-ink opacity-80 decoration-burgundy underline-offset-[5px] transition-opacity duration-(--duration-fast) ease-editorial hover:underline hover:opacity-100 focus-visible:underline focus-visible:opacity-100',
  line: 'group inline-flex items-center gap-4 py-2 text-ink',
  outline:
    'border border-rule px-4 py-3 whitespace-nowrap text-ink transition-colors duration-(--duration-fast) ease-editorial hover:border-ink disabled:text-ink-muted disabled:hover:border-rule',
};
