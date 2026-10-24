import { Link, NavLink } from 'react-router';
import { DashIcon } from './DashIcon';
import { STUDIO_ROOT } from './navigation';
import { useStudioAuth } from './auth/authContext';
import { button } from './ui';
import type { StudioTheme } from './useStudioTheme';

// a sheet dropped from the top bar's right edge (native popover: light dismiss, Escape)
const SHEET =
  'm-0 inset-auto top-[calc(var(--studio-bar)+0.4rem)] right-3 w-[min(21rem,calc(100vw-1.5rem))] rounded-(--studio-r-lg) border border-(--studio-line-strong) bg-(--studio-raised) p-4 text-ink shadow-(--studio-shadow-lift)';
const BUTTON =
  'grid size-10 place-items-center rounded-(--studio-r-md) text-ink-soft transition-colors duration-(--duration-fast) hover:bg-(--studio-hover) hover:text-ink aria-expanded:bg-(--studio-selected) aria-expanded:text-ink';

/**
 * The way to the assistant, then the theme switch, notifications and the
 * account. "Open Assistant" is the one branded control in the bar - a
 * burgundy (coral, in the dark) frame on its wash, with a quiet animated highlight
 * (studio.css: .studio-assist) - and opens the assistant's own page
 * (marked current while you're on it); on phones it folds to its spark,
 * keeping its name for assistive technology. The switch says what it does
 * ("Switch to dark theme") and shows the theme it leads to. The two sheets
 * say honestly what exists: neither notifications nor sign-in are connected
 * in this prototype, so neither shows invented entries.
 */
export function TopBarActions({ theme, onToggleTheme }: { theme: StudioTheme; onToggleTheme: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  const { state, signOut } = useStudioAuth();
  return (
    <div className="flex items-center gap-0.5">
      <NavLink
        to={`${STUDIO_ROOT}/assistant`}
        aria-label="Open Assistant"
        data-tone="brand"
        className="studio-assist mr-1.5 inline-flex h-10 items-center gap-2 rounded-(--studio-r-md) border border-(--st-line) bg-(--st-bg) px-3 text-[0.875rem] font-semibold whitespace-nowrap text-(--st-fg) transition-colors duration-(--duration-fast) hover:border-(--st-solid) hover:bg-(--st-solid) hover:text-(--studio-panel) aria-[current=page]:border-(--st-solid) aria-[current=page]:bg-(--st-solid) aria-[current=page]:text-(--studio-panel) max-tablet:w-10 max-tablet:justify-center max-tablet:px-0"
      >
        <DashIcon name="sparkles" className="size-4" />
        <span aria-hidden="true" className="max-tablet:hidden">
          Open Assistant
        </span>
      </NavLink>

      <button type="button" onClick={onToggleTheme} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} className={BUTTON}>
        <DashIcon name={next === 'dark' ? 'moon' : 'sun'} />
      </button>

      <button type="button" popoverTarget="studioNotifications" aria-label="Notifications" className={BUTTON}>
        <DashIcon name="bell" />
      </button>
      <div id="studioNotifications" popover="auto" aria-labelledby="studioNotificationsTitle" className={SHEET}>
        <p className="text-[0.8125rem] font-semibold text-ink-muted">Notifications</p>
        <p id="studioNotificationsTitle" className="mt-2 type-heading text-[1.05rem] leading-tight">
          Nothing to show yet.
        </p>
        <p className="mt-1.5 text-body leading-snug text-ink-soft">
          In-app notifications aren’t built yet. New inquiries are emailed to the studio’s notification address (Settings), and everything waiting appears on the Overview.
        </p>
      </div>

      <button type="button" popoverTarget="studioAccount" aria-label="Account" className={BUTTON}>
        <DashIcon name="account" />
      </button>
      <div id="studioAccount" popover="auto" aria-labelledby="studioAccountTitle" className={SHEET}>
        <p className="text-[0.8125rem] font-semibold text-ink-muted">Account</p>
        <p id="studioAccountTitle" className="mt-2 type-heading text-[1.05rem] leading-tight">
          {state.user?.name}
        </p>
        <p className="mt-0.5 type-meta text-ink-soft">
          {state.user?.email} · {state.user?.role === 'owner' ? 'Owner' : 'Staff'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
          <Link to={`${STUDIO_ROOT}/settings`} className={button('secondary', 'sm')}>
            Settings and security
          </Link>
          <button type="button" onClick={() => void signOut()} className={button('ghost', 'sm')}>
            Sign out
          </button>
        </div>
        <Link to="/" className="mt-3 inline-flex min-h-10 items-center gap-2 type-meta text-ink hover:text-burgundy">
          View the public site
          <DashIcon name="external" className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
