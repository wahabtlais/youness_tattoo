import { Link } from 'react-router';
import { SOCIAL_LINKS } from '../../data/social';
import type { TattooWork } from '../../domain/work';
import { useInView } from '../../hooks/useInView';
import { useSiteContent } from '../../hooks/useSiteContent';
import { useWork } from '../../hooks/useWork';
import { useConsultation } from '../consultation/consultationContext';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { BrandLogo } from './BrandLogo';
import { SITE_LINKS } from './siteLinks';
import { SocialIcon } from './SocialIcon';
import { SOCIAL_ICON } from './socialIcons';

/**
 * The last chapter of every page (rendered once, by SiteLayout), on the ink
 * stock. Three parts, top to bottom:
 *
 *   the seam      the archive as a contact strip, laid along the edge where
 *                 the page's paper meets the ink - every print a way back to
 *                 its piece
 *   the invitation  the closing line, answering the hero's "The work is
 *                 already in you", and the way in (the consultation). Its
 *                 headline is part of the design; the line under it is the
 *                 studio's (site content: book.intro). It keeps the #book
 *                 anchor the home page's booking section used to have.
 *   the colophon  logo, the pages, the client's account, the only confirmed
 *                 facts (Detroit, Michigan; by appointment) and the studio's
 *                 social accounts - only verified ones (data/social.ts):
 *                 with none, there is no social area at all. No second
 *                 consultation link: the invitation's button is the one.
 *
 * (His name as oversized lettering lives in the Artist chapter now.)
 */
export function Footer() {
  const work = useWork();
  const pieces = work.status === 'success' ? work.data.slice(0, 8) : [];
  return (
    <footer data-ink="" className="overflow-x-clip bg-ink text-paper">
      {pieces.length > 0 && <ContactStrip pieces={pieces} />}
      <Invitation />
      <Colophon />
    </footer>
  );
}

/** the archive along the seam: small, dimmed until reached for, numbered like a contact sheet */
function ContactStrip({ pieces }: { pieces: TattooWork[] }) {
  return (
    <nav aria-labelledby="footerArchiveLabel">
      <ul className="grid grid-cols-4 gap-px tablet:grid-cols-8">
        {pieces.map((p) => (
          <li key={p.id}>
            <Link
              to={`/work/${p.slug}`}
              aria-label={`${p.title} ${p.id} - open it`}
              className="group relative block outline-paper focus-visible:outline-2 focus-visible:-outline-offset-4"
            >
              <ResponsiveImage
                image={p.image}
                alt=""
                ratio="5 / 4"
                sizes="(min-width: 700px) 12.5vw, 25vw"
                className="brightness-[0.72] saturate-[0.7] transition-[filter] duration-(--duration-normal) ease-editorial group-hover:brightness-100 group-hover:saturate-100 group-focus-visible:brightness-100 group-focus-visible:saturate-100 motion-reduce:transition-none"
              />
              <span aria-hidden="true" className="absolute bottom-1.5 left-2 type-meta text-paper [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
                {p.id}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-page-x">
        <p className="mx-auto flex max-w-page flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4 type-meta text-paper-muted">
          <span id="footerArchiveLabel">The archive · {String(pieces.length).padStart(2, '0')} pieces</span>
          <Link to="/work" className="inline-flex min-h-11 items-center text-paper underline decoration-burgundy-light underline-offset-[6px] transition-colors hover:text-burgundy-light">
            View all works
          </Link>
        </p>
      </div>
    </nav>
  );
}

/**
 * The closing invitation: the largest type since the hero, one burgundy
 * stroke under "work" drawn once as it arrives (simply there under reduced
 * motion), and the consultation as the one solid button on the ink.
 */
function Invitation() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const consultation = useConsultation();
  const copy = useSiteContent().content.book;
  return (
    <section id="book" aria-labelledby="footerInviteHeading" className="px-page-x pt-[clamp(4.5rem,13vh,8.5rem)]">
      <div ref={ref} data-in={inView} className="group/book mx-auto max-w-page">
        <h2 id="footerInviteHeading" className="font-serif text-[clamp(2.9rem,7.6vw,7.4rem)] leading-[0.96] tracking-[-0.025em] text-balance">
          Bring the idea.{' '}
          <span className="block text-burgundy-light italic">
            We’ll find the{' '}
            <span className="relative inline-block">
              work
              <svg
                aria-hidden="true"
                viewBox="0 0 300 28"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -bottom-[0.16em] left-[-6%] h-[0.26em] w-[112%] overflow-visible"
              >
                <path
                  d="M4 18 C 52 6, 104 26, 158 15 S 252 3, 296 13"
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="[stroke-dasharray:1] motion-safe:transition-[stroke-dashoffset] motion-safe:delay-300 motion-safe:duration-[2.4s] motion-safe:ease-editorial motion-safe:group-data-[in=false]/book:[stroke-dashoffset:1] motion-safe:group-data-[in=true]/book:[stroke-dashoffset:0]"
                />
              </svg>
            </span>{' '}
            in it.
          </span>
        </h2>
        <div className="mt-[clamp(2.5rem,6vh,4rem)] grid items-end gap-x-[clamp(2rem,6vw,6rem)] gap-y-8 desktop:grid-cols-12">
          <p className="max-w-[34ch] font-serif text-lede text-paper-soft desktop:col-span-5">{copy.intro}</p>
          <div className="desktop:col-span-5 desktop:col-start-8">
            <button
              type="button"
              onClick={() => consultation.open({ from: 'book' })}
              className="group flex min-h-16 w-full items-center justify-between gap-6 border border-paper bg-paper px-7 py-4 text-left type-label text-ink transition-[background-color,border-color,translate] duration-(--duration-fast) ease-editorial hover:border-burgundy-light hover:bg-burgundy-light active:translate-y-px motion-reduce:active:translate-y-0"
            >
              Start a consultation
              <span aria-hidden="true" className="text-[1.25rem] leading-none transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
                &rarr;
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** the colophon: one ruled band, not columns of labelled lists */
function Colophon() {
  const social = SOCIAL_LINKS;
  const link = 'inline-flex min-h-11 items-center type-label text-paper decoration-burgundy-light underline-offset-[6px] transition-colors hover:text-burgundy-light hover:underline';
  return (
    <div className="px-page-x">
      <div className="mx-auto mt-[clamp(3rem,9vh,6.5rem)] grid max-w-page items-center gap-x-10 gap-y-5 border-t border-paper/15 pt-6 pb-[clamp(2rem,6vh,3.5rem)] tablet:grid-cols-[auto_minmax(0,1fr)] desktop:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Link to={{ pathname: '/', hash: '#hero' }} className="inline-block w-fit">
          <BrandLogo tone="dark" alt="Younes Tattoo — home" className="h-[clamp(2.75rem,3.6vw,3.4rem)]" />
        </Link>
        <nav aria-label="Footer" className="desktop:justify-self-center">
          <ul className="flex flex-wrap gap-x-[clamp(1.25rem,2.6vw,2.25rem)]">
            {SITE_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/portal" className={link}>
                Your account
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 tablet:col-span-2 desktop:col-span-1">
          <p className="type-meta leading-normal text-paper-muted">
            Detroit, Michigan · by appointment
            <br />© {new Date().getFullYear()} Younes Tattoo
          </p>
          {social.length > 0 && (
            <ul aria-label="Follow the studio" className="flex flex-wrap gap-2">
              {social.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${SOCIAL_ICON[s.network].title}: ${s.handle} (opens in a new tab)`}
                    className="grid size-11 place-items-center border border-paper/30 text-paper transition-colors hover:border-burgundy-light hover:bg-burgundy-light hover:text-ink"
                  >
                    <SocialIcon network={s.network} className="size-[1.1rem]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
