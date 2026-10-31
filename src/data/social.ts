/**
 * The studio's social accounts, shown in the footer's "Follow" area.
 *
 * EMPTY ON PURPOSE: no verified account URLs or handles have been supplied,
 * and none are guessed. While this list is empty the footer shows no social
 * area at all in production (development shows a marked note saying where
 * to add them). Add each real account exactly as it exists, e.g.
 *
 *   { network: 'instagram', handle: '@exact.handle', url: 'https://www.instagram.com/exact.handle/' },
 */
export interface SocialLink {
  network: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'threads' | 'x';
  /** shown as written, e.g. "@exact.handle" */
  handle: string;
  /** the account's own page - never a network's home page */
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [];
