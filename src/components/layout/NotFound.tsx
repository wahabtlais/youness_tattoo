import { Link, type To } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface NotFoundProps {
  /** what was looked for, as a sentence: "That story isn’t in the journal." */
  title: string;
  detail?: string;
  /** where to go instead - the most useful first */
  links: { to: To; label: string }[];
}

/**
 * Something asked for that doesn't exist - an address, a piece, a story, a
 * call - set like the rest of the site: a plate label, one serif line, a
 * mono note, and real ways on. Never a blank page or a stand-in record.
 */
export function NotFound({ title, detail = 'The address may be mistyped, or what it pointed to has moved.', links }: NotFoundProps) {
  useDocumentTitle('Not found');
  return (
    <section aria-labelledby="notFoundTitle" className="mx-auto flex min-h-svh max-w-page flex-col justify-center px-page-x pt-[clamp(6rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)]">
      <p className="type-eyebrow text-burgundy">/ 404 · Not found</p>
      <h1 id="notFoundTitle" className="mt-4 max-w-[18ch] font-serif text-[clamp(2.2rem,5.5vw,4.4rem)] leading-[1.02] tracking-[-0.015em]">
        {title}
      </h1>
      <p className="mt-5 max-w-[46ch] text-body leading-copy text-ink-soft">{detail}</p>
      <ul className="mt-8 flex flex-wrap gap-x-10 gap-y-2 border-t border-rule pt-5">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="group inline-flex min-h-11 items-center gap-4 type-label text-ink">
              <span aria-hidden="true" className="h-px w-[2.4em] origin-right bg-burgundy transition-[scale] duration-(--duration-slow) ease-editorial group-hover:scale-x-160 group-focus-visible:scale-x-160 motion-reduce:transition-none" />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
