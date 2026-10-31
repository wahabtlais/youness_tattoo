import type { DashIconName } from './dashIcons';

/**
 * The dashboard's destinations, in the sidebar's order - all built. An
 * address that matches none opens an honest "no such page" view
 * (SectionPlaceholder).
 */
export interface DashboardSection {
  /** URL segment under /studio ('' is the Overview) */
  slug: string;
  label: string;
  icon: DashIconName;
  /** what the section will be for, shown on its placeholder */
  purpose: string;
  built?: true;
}

export const STUDIO_ROOT = '/studio';

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { slug: '', label: 'Overview', icon: 'overview', purpose: 'The studio at a glance.', built: true },
  { slug: 'inquiries', label: 'Inquiries', icon: 'inquiries', purpose: 'Every consultation that arrives from the website, with its references and status.', built: true },
  { slug: 'clients', label: 'Clients', icon: 'clients', purpose: 'The people behind the work: their ideas, appointments and what you owe them, in one record.', built: true },
  { slug: 'calendar', label: 'Calendar', icon: 'calendar', purpose: 'Sessions, consultations and aftercare check-ins, by day, week and month.', built: true },
  { slug: 'portfolio', label: 'Portfolio', icon: 'portfolio', purpose: 'The work on the public site: photographs, what is confirmed about them, and where they are used.', built: true },
  { slug: 'publishing', label: 'Journal & Canvas Calls', icon: 'publishing', purpose: 'Journal stories and canvas calls on the public site, with what each links to.', built: true },
  { slug: 'website', label: 'Website Management', icon: 'globe', purpose: 'Which home-page sections show, and their words. The design itself is not editable.', built: true },
  { slug: 'assistant', label: 'Assistant', icon: 'assistant', purpose: 'Ask about the studio, prepare drafts and reminders. Anything that reaches a client, or changes a booking, waits for your approval.', built: true },
  { slug: 'settings', label: 'Settings', icon: 'lock', purpose: 'The studio’s settings, its email, and your account.', built: true },
];

export const sectionPath = (s: DashboardSection) => (s.slug ? `${STUDIO_ROOT}/${s.slug}` : STUDIO_ROOT);
