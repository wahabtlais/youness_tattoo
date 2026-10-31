import type {
  BodyArea,
  Consultation,
  ConsultationEntry,
  ConsultationSummary,
  TattooScale,
  Timeframe,
} from '../../domain/consultation';

/**
 * The consultation draft: a `Consultation` (domain) the client is filling
 * in, plus where they are in the steps (UI). Kept in memory while the page
 * is open; sent to the studio only when the client sends it from the
 * review (submitConsultation.ts) - and called sent only once the studio's
 * server has stored it and returned a receipt.
 */

export type ConsultationStep = 'idea' | 'placement' | 'timing' | 'contact' | 'review' | 'done';

/** the steps with progress, in order ('done' is the confirmation after them) */
export const STEPS: { step: Exclude<ConsultationStep, 'done'>; name: string }[] = [
  { step: 'idea', name: 'The idea' },
  { step: 'placement', name: 'Placement and scale' },
  { step: 'timing', name: 'Timing and details' },
  { step: 'contact', name: 'Your details' },
  { step: 'review', name: 'Review' },
];

/** how Younes can reach them - only what they choose to give, name and email required */
export interface DraftContact {
  name: string;
  email: string;
  phone: string;
  instagram: string;
}

export interface DraftState {
  consultation: Consultation;
  step: ConsultationStep;
  /** came to a step from the review to change something: it leads back there */
  fromReview: boolean;
  contact: DraftContact;
  /** they've read how their details are used, and agreed */
  consent: boolean;
  /** this draft's own id for the server: sending it twice files it once */
  submissionKey: string;
  /** when the draft began - the server notices a form filled faster than a person could */
  startedAt: string;
  /** the studio's receipt, once the server has stored it */
  receipt?: { receiptId: string; receivedAt: string };
}

/** the choices offered - starting points for a conversation, never specifications */
export const BODY_AREAS: { value: BodyArea; label: string }[] = [
  { value: 'forearm', label: 'Forearm' },
  { value: 'upper-arm', label: 'Upper arm' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'leg', label: 'Leg' },
  { value: 'hand', label: 'Hand or fingers' },
  { value: 'other', label: 'Somewhere else' },
  { value: 'not-sure', label: 'Not sure yet' },
];

export const SCALES: { value: TattooScale; label: string; hint?: string }[] = [
  { value: 'small', label: 'Small', hint: 'Around palm-sized or smaller' },
  { value: 'medium', label: 'Medium', hint: 'About the length of a hand' },
  { value: 'large', label: 'Large', hint: 'A good part of an arm or leg' },
  { value: 'large-scale', label: 'Large-scale', hint: 'A sleeve or back piece, over several sessions' },
  { value: 'not-sure', label: 'Not sure yet' },
];

export const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 'soon', label: 'As soon as possible' },
  { value: 'months', label: 'In the next few months' },
  { value: 'no-rush', label: 'No rush' },
  { value: 'not-sure', label: 'Not sure yet' },
];

export const labelOf = <T extends string>(list: { value: T; label: string }[], value: T | undefined) =>
  value === undefined ? undefined : list.find((o) => o.value === value)?.label;

/**
 * Which draft an entry opens. Ask Younes, the booking section (any general
 * entry) share one; each starting piece in Find Similar has its own - so a
 * client's general idea and a piece-led one never overwrite each other.
 */
export const draftKey = (entry: ConsultationEntry) =>
  entry.from === 'find-similar'
    ? `find-similar:${entry.workId}`
    : entry.from === 'canvas-call'
      ? `canvas-call:${entry.callSlug}`
      : 'general';

const newId = () => `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const newDraft = (entry: ConsultationEntry): DraftState => ({
  consultation: { id: newId(), status: 'draft', entry, summary: { references: [] }, createdAt: new Date().toISOString() },
  step: 'idea',
  fromReview: false,
  contact: { name: '', email: '', phone: '', instagram: '' },
  consent: false,
  submissionKey: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
});

/**
 * Opening a draft again. Its answers are kept and it resumes where it was.
 * From Find Similar, the references are always Find Similar's latest
 * selection (that is where the client chooses them); if they changed after
 * the draft was finished, it goes back to the review to be looked over.
 */
export function reopenDraft(draft: DraftState, entry: ConsultationEntry): DraftState {
  // a sent consultation is finished: a new idea starts a new draft (keeping who they are)
  if (draft.receipt) return { ...newDraft(entry), contact: draft.contact };
  if (entry.from !== 'find-similar') return draft;
  const changed = JSON.stringify(entry) !== JSON.stringify(draft.consultation.entry);
  if (!changed) return draft;
  const done = draft.step === 'done';
  return {
    ...draft,
    consultation: { ...draft.consultation, entry, ...(done ? { reviewedAt: undefined } : {}) },
    step: done ? 'review' : draft.step,
  };
}

/** an answer changed: an empty text answer is no answer */
export function withAnswer<K extends keyof ConsultationSummary>(
  draft: DraftState,
  key: K,
  value: ConsultationSummary[K],
): DraftState {
  const summary = { ...draft.consultation.summary };
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) delete summary[key];
  else summary[key] = value;
  return { ...draft, consultation: { ...draft.consultation, summary } };
}

/** trimmed text for display, or undefined when there is none */
export const text = (value: string | undefined) => value?.trim() || undefined;

/** controls stay a comfortable touch size below desktop (44px) */
export const TAP = 'inline-flex min-h-11 items-center desktop:min-h-0';
