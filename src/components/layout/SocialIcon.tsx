import type { SocialLink } from '../../data/social';
import { SOCIAL_ICON } from './socialIcons';

/** a network's mark, drawn in the current colour (monochrome, as the footer is) */
export function SocialIcon({ network, className }: { network: SocialLink['network']; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={SOCIAL_ICON[network].path} />
    </svg>
  );
}
