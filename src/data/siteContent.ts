import { ARTIST } from './artist';
import { PROCESS_INTRO, PROCESS_STEPS, type ProcessStep } from './process';

/**
 * The home page's editable copy and optional sections - the one place the
 * public site reads them from, and the shape the dashboard's Website
 * Management edits. What's here is the published content: the site renders
 * exactly this. Layout, type, colour, images and the order of sections are
 * not content and aren't in it.
 *
 * Not in it, on purpose:
 * - the hero, the work archive and the Book section's headline - approved
 *   designs whose words are part of the composition;
 * - records with their own homes: pieces (Portfolio), journal posts and
 *   canvas calls (Journal & Canvas Calls), testimonials
 *   (data/clientExperiences.ts, with each client's consent).
 *
 * Drafts edited in the dashboard live in the editor's browser only
 * (content/siteDraft.ts) until a backend can publish them: then this file
 * becomes the fetch, and nothing that reads it changes.
 */

/** the home page sections that can be hidden: none of them is a way in, and nothing links to them */
export type OptionalSection = 'artist' | 'experiences' | 'process' | 'journal' | 'canvasCalls';

export interface SiteContent {
  visible: Record<OptionalSection, boolean>;
  artist: {
    label: string;
    headline: string;
    /** short facts under his name: the second is also the portrait's caption */
    meta: string[];
    /** his introduction, a paragraph per entry; empty until he writes it */
    intro: string[];
  };
  experiences: { eyebrow: string; heading: string; intro: string };
  process: { eyebrow: string; heading: string; intro: string; steps: ProcessStep[]; closing: string };
  journal: { eyebrow: string; heading: string; intro: string };
  canvasCalls: { heading: string; intro: string };
  book: { intro: string };
}

export const SITE_CONTENT: SiteContent = {
  visible: { artist: true, experiences: true, process: true, journal: true, canvasCalls: true },
  artist: {
    label: ARTIST.label,
    headline: ARTIST.headline,
    meta: [...ARTIST.meta],
    intro: ARTIST.intro ?? [],
  },
  experiences: {
    eyebrow: 'Client experiences',
    heading: 'More than the finished piece.',
    intro: 'Stories about the ideas, conversations, and decisions behind a tattoo.',
  },
  process: {
    eyebrow: 'The process',
    heading: 'From the first idea to the final piece.',
    intro: PROCESS_INTRO,
    steps: PROCESS_STEPS.map((s) => ({ ...s })),
    closing: 'It begins with a conversation.',
  },
  journal: {
    eyebrow: 'Journal',
    heading: 'News from the studio.',
    intro: 'Conventions, guest spots, results and studio news — what’s coming up, and what has happened.',
  },
  canvasCalls: {
    heading: 'Looking for a canvas.',
    intro: 'Particular pieces Younes wants to tattoo, each looking for the person to wear it. Respond to one and the consultation starts with the call attached.',
  },
  book: {
    intro: 'Tell me what you’re thinking — we’ll take it from there.',
  },
};
