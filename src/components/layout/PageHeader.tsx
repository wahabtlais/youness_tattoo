import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  /** beside the intro: a demo notice, a count */
  aside?: ReactNode;
}

/**
 * The opening of an inner page (Work, Journal, Canvas Calls), set like the
 * home sections: a plate label, a large serif title, a mono intro - clear
 * of the fixed masthead, closed by a hairline.
 */
export function PageHeader({ eyebrow, title, intro, aside }: PageHeaderProps) {
  return (
    <header className="mx-auto max-w-page px-page-x pt-[clamp(7.5rem,18vh,11rem)]">
      <div className="grid gap-x-[clamp(2rem,6vw,6rem)] gap-y-6 border-b border-rule pb-[clamp(2rem,5vh,3.5rem)] desktop:grid-cols-12 desktop:items-end">
        <div className="desktop:col-span-7">
          <p className="type-eyebrow text-burgundy">{eyebrow}</p>
          <h1 className="mt-4 max-w-[14ch] font-serif text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">{title}</h1>
        </div>
        {(intro || aside) && (
          <div className="grid gap-4 desktop:col-span-4 desktop:col-start-9 desktop:pb-2">
            {intro && <div className="max-w-[40ch] text-body leading-copy text-ink-soft">{intro}</div>}
            {aside}
          </div>
        )}
      </div>
    </header>
  );
}
