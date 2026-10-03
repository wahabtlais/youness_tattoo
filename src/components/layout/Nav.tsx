import './Nav.css';

const LINKS = [
  { href: '#work', label: 'Work' },
  { href: '#studio', label: 'Studio' },
  { href: '#book', label: 'Book' },
];

/**
 * Persistent but minimal - brand plus three anchor links, no dropdowns,
 * no sticky background chrome. Native anchor scrolling + the smooth-scroll
 * rule in global.css do the work; JS isn't required.
 */
export function Nav() {
  return (
    <div className="siteNav">
      <a className="siteNav__brand" href="#hero">
        Younes<span>&thinsp;/&thinsp;</span>Tattoo
      </a>
      <nav aria-label="Sections">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
