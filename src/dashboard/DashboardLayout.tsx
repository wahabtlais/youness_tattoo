import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Dialog } from '../components/ui/Dialog';
import { DashIcon } from './DashIcon';
import { DashboardNav } from './DashboardNav';
import { STUDIO_ROOT } from './navigation';
import './studio.css';
import { TopBarActions } from './TopBarActions';
import { AuthGate } from './auth/AuthGate';
import { useStudioTheme } from './useStudioTheme';

/**
 * The private studio's frame (/studio/*), behind its sign-in (AuthGate):
 * a top bar (identity, theme, notifications, account), a sidebar with the
 * destinations (a menu sheet on phones) and the page beside it. Its own
 * light and dark themes (studio.css), scoped to this root so nothing reaches
 * the public site. Shares the site's type and brand, none of its frame. Not
 * for search engines.
 */
export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { theme, toggle } = useStudioTheme();

  // a new page starts at its top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div data-theme={theme} className="studio min-h-svh [--studio-bar:3.75rem]">
      <meta name="robots" content="noindex, nofollow" />
      <a
        href="#studioMain"
        className="sr-only z-50 rounded-(--studio-r-sm) bg-(--studio-raised) px-4 py-3 type-label focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <AuthGate>
      <header className="sticky top-0 z-30 flex h-(--studio-bar) items-center gap-3 border-b border-rule bg-(--studio-chrome)/92 px-2 backdrop-blur-md tablet:px-4">
        <button
          type="button"
          aria-label="Open the studio menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="grid size-10 place-items-center rounded-(--studio-r-md) text-ink-soft hover:bg-(--studio-hover) hover:text-ink tablet:hidden"
        >
          <DashIcon name="menu" />
        </button>
        <Link to={STUDIO_ROOT} className="shrink-0" aria-label="Younes Tattoo — studio overview">
          {/* one height for both: they share an aspect ratio, so the switch never shifts the bar */}
          {theme === 'dark' ? (
            <img src="/youness_tattoo_logo_dark.png" width={2129} height={738} alt="" decoding="async" className="studio-logo-dark block h-[1.9rem] w-auto max-w-none" />
          ) : (
            <BrandLogo alt="" className="h-[1.9rem]" />
          )}
        </Link>
        <span aria-hidden="true" className="hidden h-5 w-px bg-(--studio-line-strong) tablet:block" />
        <p className="hidden text-[0.875rem] font-semibold text-ink-soft tablet:block">Private studio</p>
        <div className="ml-auto">
          <TopBarActions theme={theme} onToggleTheme={toggle} />
        </div>
      </header>

      <div className="tablet:grid tablet:grid-cols-[13rem_minmax(0,1fr)] desktop:grid-cols-[14.5rem_minmax(0,1fr)]">
        {/* the column carries the surface and the rule, full height; the sidebar itself stays in view */}
        <div className="hidden border-r border-rule bg-(--studio-chrome) tablet:block">
          <aside className="sticky top-(--studio-bar) flex h-[calc(100svh-var(--studio-bar))] flex-col overflow-y-auto pt-5">
            <DashboardNav />
            <SidebarFoot />
          </aside>
        </div>

        {/* its padding is named, so a page can fill exactly the height left to it (the inquiry map) */}
        <main
          id="studioMain"
          tabIndex={-1}
          className="@container min-w-0 px-[clamp(1rem,2.2vw,2rem)] pt-(--studio-main-top) pb-(--studio-main-bottom) outline-none [--studio-main-bottom:3rem] [--studio-main-top:clamp(1.25rem,3vh,1.75rem)]"
        >
          <div className="mx-auto max-w-[96rem]">
            <Outlet />
          </div>
        </main>
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="studioMenuTitle"
        className="m-0 h-full max-h-none w-[min(18rem,86vw)] max-w-none border-r border-rule bg-(--studio-chrome) p-0 text-ink backdrop:bg-[rgb(0_0_0/0.45)] motion-safe:open:animate-fade-in"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-(--studio-bar) items-center justify-between border-b border-rule pr-2 pl-4">
            <p id="studioMenuTitle" className="text-[0.875rem] font-semibold text-ink-soft">
              Private studio
            </p>
            <button
              type="button"
              aria-label="Close the menu"
              onClick={() => setMenuOpen(false)}
              className="grid size-10 place-items-center rounded-(--studio-r-md) text-ink-soft hover:bg-(--studio-hover) hover:text-ink"
            >
              <DashIcon name="close" />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto pt-5">
            <DashboardNav onNavigate={() => setMenuOpen(false)} />
            <SidebarFoot />
          </div>
        </div>
      </Dialog>
      </AuthGate>
    </div>
  );
}

/** under the destinations: what's sample data, and the way back to the public site */
function SidebarFoot() {
  return (
    <div className="mt-auto grid gap-1 px-3 pt-8 pb-5">
      <p data-tone="brand" className="flex items-start gap-2 rounded-(--studio-r-md) border border-dashed border-(--st-line) px-2.5 py-2 text-[0.8125rem] leading-snug text-ink-soft">
        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-(--st-solid)" />
        <span>
          <span className="font-semibold text-(--st-fg)">Sample records</span> (marked “Sample”) are fictional, for trying the studio out. Everything else is real and saved.
        </span>
      </p>
      <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-(--studio-r-md) px-2.5 text-[0.875rem] font-medium text-ink-soft hover:bg-(--studio-hover) hover:text-ink">
        Public site
        <DashIcon name="external" className="size-3.5" />
      </Link>
    </div>
  );
}
