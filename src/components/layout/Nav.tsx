import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Dialog } from '../ui/Dialog';
import { BrandLogo } from './BrandLogo';
import { isHomePath, SITE_LINKS } from './siteLinks';
import './Nav.css';

/**
 * Persistent but minimal: the studio's logo (home) and the site's pages -
 * Work, Journal, Canvas Calls. No anchors into the home page and no
 * consultation button: the page's own invitations and the footer carry
 * those. Below 900px the links fold into a "Menu" sheet. The page you are
 * on is marked.
 */
export function Nav() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const home = isHomePath(pathname);

  return (
    <div className={home ? 'siteNav' : 'siteNav siteNav--page'}>
      <Link className="siteNav__brand" to={{ pathname: '/', hash: '#hero' }}>
        <BrandLogo alt="Younes Tattoo — home" className="siteNav__logo" />
      </Link>
      <nav aria-label="Site" className="siteNav__links">
        {SITE_LINKS.map((l) => (
          <NavLink key={l.label} to={l.to}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="siteNav__menu" aria-haspopup="dialog" onClick={() => setMenu(true)}>
        Menu
      </button>

      <Dialog
        open={menu}
        onClose={() => setMenu(false)}
        labelledBy="siteMenuTitle"
        // (the masthead lets clicks through to the page; its menu must take them)
        className="pointer-events-auto fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto bg-paper p-0 text-ink backdrop:bg-transparent motion-safe:open:animate-fade-in"
      >
        <div className="flex min-h-full flex-col px-page-x py-page-y">
          <div className="flex items-center justify-between">
            <Link to={{ pathname: '/', hash: '#hero' }} onClick={() => setMenu(false)} id="siteMenuTitle">
              <BrandLogo alt="Younes Tattoo — home" className="h-9" />
            </Link>
            <button type="button" onClick={() => setMenu(false)} className="min-h-11 type-label text-ink">
              Close &times;
            </button>
          </div>
          <nav aria-label="Site" className="mt-[clamp(2.5rem,10vh,5rem)] border-t border-rule">
            <ul>
              {SITE_LINKS.map((l, i) => (
                <li key={l.label} className="border-b border-rule">
                  <NavLink
                    to={l.to}
                    onClick={() => setMenu(false)}
                    className="flex min-h-11 items-baseline gap-5 py-4 font-serif text-[clamp(1.9rem,8vw,2.6rem)] leading-none aria-[current=page]:text-burgundy"
                  >
                    <span className="type-meta text-ink-soft">{String(i + 1).padStart(2, '0')}</span>
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-auto pt-10 type-meta text-ink-soft">Detroit, Michigan · by appointment</p>
        </div>
      </Dialog>
    </div>
  );
}
