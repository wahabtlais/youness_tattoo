import { CONTENT_ELEMENT_ID } from '@younes/contracts';
import type { CanvasCall } from '../domain/canvasCall';
import type { JournalPost } from '../domain/journal';
import type { TattooWork } from '../domain/work';
import type { SiteContent } from '../data/siteContent';

/**
 * The published content the server wrote into this page
 * (<script id="younes-content" type="application/json">), read once. It
 * arrives with the HTML, so the site has its words and work before the
 * first paint - the hero's hand-off to the archive never waits on a
 * request. When the page has none (the API wasn't running in development,
 * or a static host) every reader falls back to the content bundled with
 * the site, so the site never breaks for lack of it.
 */

export interface PublishedTestimonial {
  id: string;
  quote: string;
  attribution: string;
  context?: string;
  demo: boolean;
  workId?: string;
  consent?: { date: string; via: string };
}

export interface PublishedBundle {
  version: number | null;
  site: SiteContent | null;
  works: TattooWork[];
  journal: JournalPost[];
  calls: CanvasCall[];
  testimonials: PublishedTestimonial[];
}

let cached: PublishedBundle | null | undefined;

const isBundle = (v: unknown): v is PublishedBundle => {
  const b = v as PublishedBundle;
  return !!b && typeof b === 'object' && Array.isArray(b.works) && Array.isArray(b.journal) && Array.isArray(b.calls) && Array.isArray(b.testimonials);
};

/** the injected bundle, or null when the page carries none (or it can't be read) */
export function published(): PublishedBundle | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (typeof document === 'undefined') return cached;
  const el = document.getElementById(CONTENT_ELEMENT_ID);
  if (!el?.textContent) return cached;
  try {
    const data = JSON.parse(el.textContent);
    if (isBundle(data)) cached = data;
  } catch {
    // a broken bundle is ignored: the bundled content is used instead
  }
  return cached;
}
