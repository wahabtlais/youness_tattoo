/**
 * The site's pages, shared by the masthead, its menu and the footer so they
 * never disagree. Only real destinations: sections of the home page (the
 * artist, the booking invitation) are reached by scrolling it, and the
 * consultation by its own invitations - not from the masthead.
 */
export const SITE_LINKS: { label: string; to: string }[] = [
  { label: 'Work', to: '/work' },
  { label: 'Journal', to: '/journal' },
  { label: 'Canvas calls', to: '/canvas-calls' },
];

/** the home page - including a piece's detail opened over its archive (/work/:slug) */
export const isHomePath = (pathname: string) => pathname === '/' || /^\/work\/[^/]+\/?$/.test(pathname);

/**
 * Which page a path belongs to, for scrolling: moving within one page
 * (home and its piece details, a search parameter) keeps the scroll;
 * arriving on another starts at its top.
 */
export const pageOf = (pathname: string) => (isHomePath(pathname) ? '/' : pathname.replace(/\/$/, ''));
