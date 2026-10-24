import { BODY_AREAS, labelOf, SCALES, TIMEFRAMES } from '../../components/consultation/consultationDraft';
import type { ConsultationEntry, ConsultationStatus, ConsultationSummary } from '../../domain/consultation';
import { PIPELINE } from '../analytics';
import type { InquiryRecord } from '../types';

/**
 * How the Inquiries page words a consultation - the public form's own
 * labels (consultationDraft: body areas, scales, timeframes), never a
 * second vocabulary.
 */

export { labelOf, BODY_AREAS, SCALES, TIMEFRAMES };

/** "Forearm · Large", from the choices the client made (unanswered ones left out) */
export function placementLine(s: ConsultationSummary) {
  return [labelOf(BODY_AREAS, s.bodyArea), labelOf(SCALES, s.scale)].filter(Boolean).join(' · ');
}

const GENERAL: Record<string, string> = {
  hero: 'the homepage',
  work: 'the Work page',
  process: 'the Process section',
  journal: 'the Journal',
  footer: 'the footer',
  book: 'the booking section',
};

/** where on the website the inquiry started, in a few words */
export function entryLabel(e: ConsultationEntry) {
  if (e.from === 'find-similar') return `Find Similar · from piece ${e.workId}`;
  if (e.from === 'canvas-call') return 'Canvas call';
  return `Consultation · from ${GENERAL[e.from] ?? 'the website'}`;
}

/** the same, in a word, for the list: "Find Similar", "Canvas call", "Consultation" */
export const entryShort = (e: ConsultationEntry) => (e.from === 'find-similar' ? 'Find Similar' : e.from === 'canvas-call' ? 'Canvas call' : 'Consultation');

/** the statuses an inquiry can have in the studio, in pipeline order (drafts never arrive) */
export const STATUSES = PIPELINE;
export const isOpen = (s: ConsultationStatus) => PIPELINE.find((p) => p.status === s)?.open ?? true;

/** the words search looks through: the client's name and everything they wrote */
export function searchable(q: InquiryRecord) {
  const s = q.summary;
  return [q.clientName, s.concept, s.meaning, s.placement, s.size, s.notes, labelOf(BODY_AREAS, s.bodyArea), q.entry.from === 'canvas-call' ? q.entry.title : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
