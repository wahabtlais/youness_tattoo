import { Link } from 'react-router';
import { SOCIAL_LINKS } from '../../data/social';
import { useConsultation } from '../consultation/consultationContext';
import { BrandLogo } from './BrandLogo';
import { SITE_LINKS } from './siteLinks';
import { SocialIcon } from './SocialIcon';
import { SOCIAL_ICON } from './socialIcons';

/**
 * The foot of every page (rendered once, by SiteLayout), on the heavier
 * paper stock. Four parts, each with a small label: the studio (its logo,
 * and the only confirmed facts - Detroit, Michigan; by appointment), the
 * site's pages, the way in (the consultation), and Follow - the studio's
 * social accounts from data/social.ts, each its network's mark. With no
 * verified accounts there is no Follow area in production; development
 * shows a preview of the marks (not links) and where to add the accounts.
 */
export function Footer() {
  const consultation = useConsultation();
  const social = SOCIAL_LINKS;
  return (
    <footer className="bg-paper-deep px-page-x pt-[clamp(3.5rem,9vh,5.5rem)] pb-[clamp(2rem,5vh,3rem)]">
      <div className="mx-auto grid max-w-page gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 tablet:grid-cols-2 desktop:grid-cols-12">
        <div className="desktop:col-span-4">
          <Link to={{ pathname: '/', hash: '#hero' }} className="inline-block">
            <BrandLogo alt="Younes Tattoo — home" className="h-[clamp(3.25rem,4.5vw,4.25rem)]" />
          </Link>
          <p className="mt-5 type-meta leading-normal text-ink-soft">Detroit, Michigan · by appointment</p>
        </div>

        <nav aria-labelledby="footerPagesLabel" className="desktop:col-span-2 desktop:col-start-6">
          <FooterLabel id="footerPagesLabel">The site</FooterLabel>
          <ul className="grid">
            {SITE_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="inline-flex min-h-10 items-center type-label text-ink decoration-burgundy underline-offset-[6px] transition-colors hover:text-burgundy hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="desktop:col-span-3">
          <FooterLabel>Begin</FooterLabel>
          <button
            type="button"
            onClick={() => consultation.open({ from: 'footer' })}
            className="inline-flex min-h-10 items-center text-left type-label whitespace-nowrap text-ink underline decoration-burgundy underline-offset-[6px] transition-colors hover:text-burgundy"
          >
            Start a consultation
          </button>
        </div>

        {social.length > 0 ? (
          <nav aria-labelledby="footerFollowLabel" className="desktop:col-span-2">
            <FooterLabel id="footerFollowLabel">Follow</FooterLabel>
            <ul className="flex flex-wrap gap-2">
              {social.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${SOCIAL_ICON[s.network].title}: ${s.handle} (opens in a new tab)`}
                    className="grid size-11 place-items-center border border-ink/30 text-ink transition-colors hover:border-burgundy hover:bg-burgundy hover:text-paper"
                  >
                    <SocialIcon network={s.network} className="size-[1.1rem]" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          import.meta.env.DEV && (
            <div className="desktop:col-span-2">
              <FooterLabel>Follow</FooterLabel>
              <div className="border border-dashed border-burgundy/50 p-3">
                <ul aria-hidden="true" className="flex gap-2 text-ink-soft">
                  {(['instagram', 'tiktok', 'facebook'] as const).map((n) => (
                    <li key={n} className="grid size-11 place-items-center border border-ink/20">
                      <SocialIcon network={n} className="size-[1.1rem]" />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 max-w-[24ch] text-micro leading-copy text-burgundy">
                  Development preview, not links. Add verified accounts in data/social.ts; production shows nothing here until then.
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <p className="mx-auto mt-[clamp(2.5rem,6vh,3.5rem)] max-w-page border-t border-ink/15 pt-5 type-meta text-ink-soft">
        © {new Date().getFullYear()} Younes Tattoo
      </p>
    </footer>
  );
}

function FooterLabel({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="mb-2 type-meta text-burgundy">
      {children}
    </p>
  );
}
