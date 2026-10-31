import { NavLink } from 'react-router';
import { DashIcon } from './DashIcon';
import { DASHBOARD_SECTIONS, sectionPath } from './navigation';

/**
 * The dashboard's destinations - in the sidebar on wider screens, in the
 * menu sheet on phones. The current page (aria-current, from NavLink) sits
 * on the selected surface, its icon and an edge in the violet accent.
 */
export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Studio">
      <p className="px-5 pb-2 text-[0.75rem] font-bold tracking-[0.06em] text-ink-muted uppercase">Studio</p>
      <ul className="grid gap-0.5 px-2.5">
        {DASHBOARD_SECTIONS.map((s) => (
          <li key={s.slug}>
            <NavLink
              to={sectionPath(s)}
              end={!s.slug}
              onClick={onNavigate}
              className="group relative flex min-h-10 items-center gap-3 rounded-(--studio-r-md) px-2.5 text-[0.9375rem] font-medium text-ink-soft transition-colors duration-(--duration-fast) hover:bg-(--studio-hover) hover:text-ink aria-[current=page]:bg-(--studio-selected) aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              <span aria-hidden="true" className="absolute inset-y-2 -left-2.5 w-[3px] rounded-r-full bg-burgundy opacity-0 group-aria-[current=page]:opacity-100" />
              <DashIcon name={s.icon} className="size-5 group-aria-[current=page]:text-burgundy" />
              <span className="min-w-0 flex-1 leading-tight">{s.label}</span>
              {!s.built && <span className="rounded-full bg-(--studio-sunken) px-1.5 py-px text-[0.6875rem] font-semibold text-ink-muted">Soon</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
