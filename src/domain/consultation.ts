/**
 * The consultation: how a client's idea becomes something Younes can review.
 * See docs/UX_FLOWS.md. Nothing here is persisted yet - these are the
 * shapes the UI is built against so an API can slot in underneath.
 */

/** Where the client entered the consultation from. */
export type ConsultationEntry =
  | { from: 'hero' | 'work' | 'book' }
  /**
   * "Find similar" on a specific tattoo (`workId`: the piece they started
   * from), with what they chose along the way when they went through Find
   * Similar's steps rather than straight to the consultation
   */
  | { from: 'find-similar'; workId: string; selection?: FindSimilarSelection };

/**
 * What a client says draws them to a piece - their preference, not a fact
 * about the artwork (the work itself carries no such metadata yet).
 */
export type PreferenceSignal = 'subject' | 'composition' | 'linework' | 'style' | 'mood' | 'placement' | 'other';

/** What a client brings out of Find Similar into the consultation. */
export interface FindSimilarSelection {
  /** what they said speaks to them about the piece they started from */
  drawnTo: PreferenceSignal[];
  /** the same, in their own words */
  note?: string;
  /** further pieces of Younes's work they kept, in the order they kept them */
  references: string[];
}

/**
 * A visual reference attached to a consultation, in the order the product
 * reaches for them: Younes's own work first, then the client's or external
 * images, and a generated concept only as a last resort.
 */
export type TattooReference =
  | { kind: 'work'; workId: string; note?: string }
  | { kind: 'upload'; src: string; note?: string }
  | { kind: 'external'; src: string; sourceUrl: string; credit?: string; note?: string }
  /** always shown as CONCEPT / REFERENCE - never as a final design */
  | { kind: 'concept'; src: string; prompt: string; note?: string };

export type ColourPreference = 'black-and-grey' | 'colour' | 'undecided';

/**
 * What the conversation has understood so far. Every field is optional:
 * the summary fills in as the conversation goes, and the client reviews it
 * before anything is sent.
 */
export interface ConsultationSummary {
  concept?: string;
  meaning?: string;
  style?: string;
  placement?: string;
  /** free text ("palm-sized", "about 10 cm") - not a number on purpose */
  size?: string;
  colour?: ColourPreference;
  likes?: string[];
  dislikes?: string[];
  references: TattooReference[];
  notes?: string;
}

/**
 * Younes's side of a submitted consultation. He is the decision maker: the
 * client-facing site never moves a consultation past `submitted` itself.
 */
export type ConsultationStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'changes-requested'
  | 'accepted'
  | 'declined'
  | 'contacted'
  | 'booking'
  | 'completed';

export interface ClientContact {
  name: string;
  email?: string;
  phone?: string;
  instagram?: string;
}

export interface Consultation {
  id: string;
  status: ConsultationStatus;
  entry: ConsultationEntry;
  summary: ConsultationSummary;
  contact?: ClientContact;
  /** ISO 8601 */
  createdAt: string;
  submittedAt?: string;
}
