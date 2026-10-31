import { siFacebook, siInstagram, siThreads, siTiktok, siX, siYoutube, type SimpleIcon } from 'simple-icons';
import type { SocialLink } from '../../data/social';

/** each network's official glyph (simple-icons, CC0 data; the marks belong to their owners) */
export const SOCIAL_ICON: Record<SocialLink['network'], SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  facebook: siFacebook,
  youtube: siYoutube,
  threads: siThreads,
  x: siX,
};
