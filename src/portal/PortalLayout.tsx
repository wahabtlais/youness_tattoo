import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { clientApi } from '../client/api';
import { refreshClientSession, signedIn, useClientSession } from '../client/session';
import { ConsultationProvider } from '../components/consultation/ConsultationProvider';
import { BrandLogo } from '../components/layout/BrandLogo';
import { ScrollManager } from '../components/layout/ScrollManager';
import { cx } from '../lib/cx';

const SECTIONS = [
  { to: '/portal', label: 'Overview', end: true },
  { to: '/portal/projects', label: 'Projects' },
  { to: '/portal/requests', label: 'Requests' },
  { to: '/portal/appointments', label: 'Appointments' },
  { to: '/portal/aftercare', label: 'Aftercare' },
];

/**
 * The client's own pages: the site's paper and type, a slimmer masthead
 * (the logo back to the website, the five places, their profile and
 * signing out), and the consultation - the same one as on the website -
 * for starting a new idea from here. Signed out (or the session ended),
 * it goes to sign-in and comes back.
 */
export function PortalLayout() {
  const session = useClientSession();
  const account = signedIn(session);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (session.status === 'loading') {
    return (
      <div className="grid min-h-svh place-items-center bg-paper">
        <p role="status" className="type-meta text-ink-soft">
          Opening your account…
        </p>
      </div>
    );
  }
  if (!account) return <Navigate to={`/account?return=${encodeURIComponent(pathname)}`} replace />;

  async function signOut() {
    await clientApi('/logout', { method: 'POST' }).catch(() => undefined);
    await refreshClientSession();
    navigate('/');
  }

  return (
    <ConsultationProvider>
      <ScrollManager />
      <div className="min-h-svh bg-paper text-ink">
        <a href="#portal-main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-ink/15 bg-paper/95 backdrop-blur-[6px]">
          <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-page-x py-3">
            <Link to="/" className="shrink-0" aria-label="Younes Tattoo - the website">
              <BrandLogo className="h-[clamp(2.3rem,3vw,2.8rem)]" alt="" />
            </Link>
            <nav aria-label="Your account" className="hidden desktop:block">
              <ul className="flex items-center gap-[clamp(1rem,2.2vw,2rem)]">
                {SECTIONS.map((s) => (
                  <li key={s.to}>
                    <SectionLink {...s} />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-4">
              <NavLink
                to="/portal/profile"
                className={({ isActive }) => cx('hidden min-h-11 items-center type-label tablet:inline-flex', isActive ? 'text-burgundy' : 'text-ink-soft hover:text-ink')}
              >
                {account.name.split(' ')[0]}
              </NavLink>
              <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center border border-ink/40 px-3 type-label text-ink hover:border-ink hover:bg-ink hover:text-paper">
                Sign out
              </button>
            </div>
          </div>
          {/* phones and tablets: the five places as a row of tabs */}
          <nav aria-label="Your account" className="desktop:hidden">
            <ul className="mx-auto flex max-w-page gap-5 overflow-x-auto px-page-x scrollbar-none">
              {[...SECTIONS, { to: '/portal/profile', label: 'Profile' }].map((s) => (
                <li key={s.to} className="shrink-0">
                  <SectionLink {...s} />
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="portal-main" className="mx-auto max-w-page px-page-x pt-[clamp(2rem,6vh,3.5rem)] pb-[clamp(4rem,10vh,6rem)]">
          <Outlet />
        </main>
        <footer className="border-t border-ink/15 py-6">
          <p className="mx-auto flex max-w-page flex-wrap justify-between gap-3 px-page-x type-meta text-ink-soft">
            <span>Younes Tattoo · Detroit, Michigan · by appointment</span>
            <Link to="/" className="underline decoration-burgundy underline-offset-4 hover:text-ink">
              Back to the website
            </Link>
          </p>
        </footer>
      </div>
    </ConsultationProvider>
  );
}

function SectionLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'relative inline-flex min-h-11 items-center type-label transition-colors',
          'after:absolute after:inset-x-0 after:bottom-1.5 after:h-px after:origin-left after:bg-burgundy after:transition-transform motion-reduce:after:transition-none',
          isActive ? 'text-ink after:scale-x-100' : 'text-ink-soft after:scale-x-0 hover:text-ink',
        )
      }
    >
      {label}
    </NavLink>
  );
}
