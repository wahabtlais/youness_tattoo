import { Link, useParams } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DashIcon } from '../DashIcon';
import { DASHBOARD_SECTIONS, STUDIO_ROOT } from '../navigation';

/**
 * /studio/:section for a destination that isn't built yet: its name, what
 * it will hold, and plainly that it's not here - never a mock module that
 * looks like it works. An unknown section says it doesn't exist.
 */
export function SectionPlaceholder() {
  const { section } = useParams();
  const s = DASHBOARD_SECTIONS.find((x) => x.slug && x.slug === section);
  useDocumentTitle(s ? s.label : 'Not found');

  return (
    <div className="max-w-[48rem]">
      <p className="type-meta text-ink-muted">Studio · {s ? s.label : 'Not found'}</p>
      <h1 className="mt-1 studio-title text-[clamp(1.75rem,2.4vw,2.2rem)] leading-tight">
        {s ? s.label : 'There’s no such page in the studio.'}
      </h1>
      {s && <p className="mt-1 max-w-[60ch] text-body leading-snug text-ink-soft">{s.purpose}</p>}

      <div className="mt-6 rounded-(--studio-r-lg) border border-dashed border-(--studio-line-strong) bg-(--studio-panel) px-[clamp(1.25rem,3vw,2rem)] py-7">
        <p className="flex items-center gap-3 type-meta text-ink-soft">
          {s && <DashIcon name={s.icon} />}
          {s ? 'Not built yet' : 'Unknown address'}
        </p>
        <p className="mt-3 type-heading text-[1.25rem] leading-snug">
          {s ? 'This part of the studio is still being designed.' : 'Choose a destination from the menu.'}
        </p>
        <p className="mt-3 max-w-[52ch] text-body leading-copy text-ink-soft">
          {s
            ? 'Nothing here is connected yet. The Overview shows the visual system this page will follow.'
            : 'The address doesn’t match any part of the private studio.'}
        </p>
        <Link
          to={STUDIO_ROOT}
          className="group mt-5 inline-flex min-h-10 items-center gap-2 type-meta text-ink hover:text-burgundy"
        >
          <span className="underline decoration-burgundy underline-offset-[6px]">Back to the overview</span>
          <DashIcon name="arrow" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </div>
  );
}
