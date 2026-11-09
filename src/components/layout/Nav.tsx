import { useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ConsultationContext } from '../consultation/consultationContext';
import { Dialog } from '../ui/Dialog';
import { BrandLogo } from './BrandLogo';
import { isHomePath, SITE_LINKS } from './siteLinks';
import './Nav.css';

/**
 * Persistent but minimal: the studio's logo (home), the site's pages -
 * Work, Journal, Canvas Calls - and the one action the whole site leads to,
 * starting a consultation, as a small framed button. Below 900px the links
 * and the button fold into a "Menu" sheet. The page you are on is marked.
 * (The pre-rendered hero renders this masthead without the consultation's
 * provider: the button is inert until the app has loaded.)
 */
export function Nav() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const home = isHomePath(pathname);
  const consultation = useContext(ConsultationContext);
  const { ref: navRef, over: overInk } = useOverInk();
  const begin = () => {
    setMenu(false);
    consultation?.open({ from: 'book' });
  };

  return (
    <div ref={navRef} className={[home ? 'siteNav' : 'siteNav siteNav--page', overInk && 'siteNav--ink'].filter(Boolean).join(' ')}>
      <Link className="siteNav__brand" to={{ pathname: '/', hash: '#hero' }}>
        <BrandLogo alt="Younes Tattoo — home" className="siteNav__logo" />
        {/* over the ink chapters: the official white mark, cross-faded in */}
        <BrandLogo tone="dark" alt="" className="siteNav__logo siteNav__logo--dark" />
      </Link>
      <nav aria-label="Site" className="siteNav__links">
        {SITE_LINKS.map((l) => (
          <NavLink key={l.label} to={l.to}>
            {l.label}
          </NavLink>
        ))}
        {/* a client's own pages (signed out, they lead to signing in) */}
        <NavLink to="/portal">Account</NavLink>
        <button type="button" className="siteNav__book" onClick={begin}>
          Start a consultation
        </button>
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
          <button
            type="button"
            onClick={begin}
            className="mt-10 inline-flex min-h-12 w-full items-center justify-center gap-3 border border-burgundy bg-burgundy px-6 py-3 type-label text-paper"
          >
            Start a consultation <span aria-hidden="true">&rarr;</span>
          </button>
          <Link to="/portal" onClick={() => setMenu(false)} className="mt-4 inline-flex min-h-12 w-full items-center justify-center border border-ink/55 px-6 py-3 type-label text-ink">
            Your account
          </Link>
          <p className="mt-auto pt-10 type-meta text-ink-soft">Detroit, Michigan · by appointment</p>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Is the masthead over one of the ink chapters ([data-ink]: the Artist, the
 * booking and the footer)? Then it inverts - an ink strip, paper type, the
 * white logo - instead of laying a paper band across the black. Watched by
 * an IntersectionObserver over the masthead's own band (a change of state
 * only when a chapter enters or leaves it, nothing per scroll frame); the
 * home page mounts its lower sections after the first paint, so new chapters
 * are picked up as they arrive.
 */
function useOverInk() {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const under = new Set<Element>();
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io?.disconnect();
      under.clear();
      // a one-pixel line through the middle of the masthead: what is under it (a chapter
      // merely touching the band's edge doesn't count)
      const line = Math.round(nav.getBoundingClientRect().height / 2);
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) under.add(e.target);
            else under.delete(e.target);
          }
          setOver(under.size > 0);
        },
        { rootMargin: `-${line}px 0px -${Math.max(0, innerHeight - line - 1)}px 0px` },
      );
      document.querySelectorAll('[data-ink]').forEach((el) => io!.observe(el));
    };
    watch();
    let count = document.querySelectorAll('[data-ink]').length;
    const mo = new MutationObserver(() => {
      const now = document.querySelectorAll('[data-ink]').length;
      if (now !== count) {
        count = now;
        watch();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', watch);
    return () => {
      io?.disconnect();
      mo.disconnect();
      removeEventListener('resize', watch);
    };
  }, []);
  return { ref, over };
}
