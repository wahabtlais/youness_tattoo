import type { ConsultationStatus } from '../../domain/consultation';
import { PIPELINE } from '../analytics';
import type { DashIconName } from '../dashIcons';
import { STATUS_LABEL } from '../format';

/**
 * The Inquiries page's categories: one per status the studio sees (the
 * project's own ConsultationStatus, drafts excepted), in pipeline order,
 * grouped as the Overview groups them - the active pipeline, then closed
 * outcomes - plus All. A record belongs to exactly one status, so the
 * category counts always add up to All.
 */
export interface Category {
  /** URL segment: /studio/inquiries/:slug */
  slug: string;
  label: string;
  /** what's in it, in a line */
  description: string;
  icon: DashIconName;
  /** null for All */
  status: ConsultationStatus | null;
  group: 'active' | 'closed' | 'all';
  /** these wait on Younes himself */
  attention?: true;
}

const ABOUT: Record<ConsultationStatus, { slug: string; description: string; icon: DashIconName; attention?: true }> = {
  submitted: { slug: 'new', description: 'Sent from the website and not yet reviewed.', icon: 'inquiries', attention: true },
  'under-review': { slug: 'in-review', description: 'Being read and considered before you answer.', icon: 'prepare', attention: true },
  'changes-requested': { slug: 'needs-details', description: 'Waiting on the client for more detail.', icon: 'reply' },
  contacted: { slug: 'contacted', description: 'You’ve been in touch; the conversation continues.', icon: 'assistant' },
  accepted: { slug: 'accepted', description: 'You’ve said yes; a booking comes next.', icon: 'check' },
  booking: { slug: 'booking', description: 'Sessions being arranged or on the calendar.', icon: 'calendar' },
  completed: { slug: 'completed', description: 'The tattoo is done.', icon: 'portfolio' },
  declined: { slug: 'declined', description: 'Not taken on.', icon: 'close' },
  // drafts stay on the client's device and never reach the studio
  draft: { slug: 'draft', description: '', icon: 'inquiries' },
};

export const ALL: Category = { slug: 'all', label: 'All inquiries', description: 'Every inquiry from the last 12 weeks, whatever its status.', icon: 'overview', status: null, group: 'all' };

export const CATEGORIES: Category[] = PIPELINE.map(({ status, open }) => ({
  ...ABOUT[status],
  label: STATUS_LABEL[status],
  status,
  group: open ? 'active' : 'closed',
}));

export const categoryBySlug = (slug: string | undefined) => (slug === ALL.slug ? ALL : CATEGORIES.find((c) => c.slug === slug));
/** the category an inquiry of this status lives in */
export const slugOf = (status: ConsultationStatus) => ABOUT[status].slug;
