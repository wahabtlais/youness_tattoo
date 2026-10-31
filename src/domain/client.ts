/**
 * The client record (artist side - not used by the public site yet; see
 * docs/FUTURE_AI.md). A consultation is the first entry in a relationship,
 * not a disposable form:
 *
 *   Client -> consultations -> bookings -> tattoo -> aftercare -> next consultation
 */
import type { ClientContact } from './consultation';
import type { ImageAsset } from './media';

/**
 * Someone who has reached out (website, or later a messaging channel) but
 * has not been booked yet - "client muhtamal".
 */
export interface PotentialClient {
  id: string;
  contact: ClientContact;
  /** where they first reached Younes */
  channel: 'website' | 'whatsapp' | 'instagram' | 'facebook' | 'other';
  consultationIds: string[];
  /** ISO 8601 */
  firstContactAt: string;
}

export interface Client {
  id: string;
  contact: ClientContact;
  consultationIds: string[];
  bookingIds: string[];
  /** ISO 8601 */
  since: string;
}

export type BookingStatus = 'proposed' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  clientId: string;
  consultationId: string;
  status: BookingStatus;
  /** ISO 8601; absent while a date is still being agreed */
  startsAt?: string;
}

export interface Aftercare {
  bookingId: string;
  /** ISO 8601 of each planned check-in */
  followUps: string[];
}

/**
 * A client's own words about working with Younes, for the public site.
 * Published only with their permission - recorded here, so nothing reaches
 * the page without it - and never edited beyond what they agreed to.
 */
export interface ClientTestimonial {
  id: string;
  /** exactly as the client wrote or approved it */
  quote: string;
  /** how they agreed to be named: a first name, initials... */
  attribution: string;
  /** the piece it is about, if they agreed to link it */
  workId?: string;
  /** a few words they approved, e.g. "Forearm, 2025" */
  context?: string;
  /** a photograph of them, only if they supplied it and agreed to it being shown */
  portrait?: { image: ImageAsset; alt: string };
  /** their own recording of it, only if they supplied it and agreed to it being played */
  voice?: VoiceRecording;
  /** their permission to publish (their words, and their portrait if given): when, and how */
  consent: { date: string; via: string };
}

/**
 * A recording as the page plays it. Everything here is measured from the
 * file itself (scripts may compute it), never estimated: the page shows
 * the length before the file loads, and draws the waveform from its peaks.
 */
export interface VoiceAudio {
  /** the audio file - an imported asset URL, e.g. `import note from '../assets/testimonials/x.m4a'` */
  src: string;
  /** seconds, measured from the file; the player prefers the file's own once loaded */
  duration?: number;
  /** the waveform: loudness per bar (0..1), computed from the file */
  peaks?: number[];
}

/**
 * A client's spoken testimonial: the real file they sent, never a synthetic
 * or re-recorded voice.
 */
export interface VoiceRecording extends VoiceAudio {
  /**
   * what they say, when it differs from the written quote (a longer or
   * looser telling); absent when the quote already is the transcript
   */
  transcript?: string;
  /**
   * their permission to publish the recording itself - separate from the
   * written words, since agreeing to be quoted is not agreeing to be heard
   */
  consent: { date: string; via: string };
}

/**
 * A fictional testimonial for design and development only - never a
 * client's words. It has no consent (there is no one to give it) and is
 * never presented as the person behind a real piece of Younes's work (a
 * sample portfolio image is captioned as just that), and the site labels it as
 * fictional wherever it is shown. It may carry stand-ins for the parts a
 * real testimonial would have, each marked as such: a drawn placeholder
 * instead of a photograph, and a computer voice reading the fictional words
 * instead of a recording.
 */
export interface DemoTestimonial {
  /** marks the record itself as fictional, not only the list it is in */
  demo: true;
  id: string;
  quote: string;
  /** an obviously made-up name */
  attribution: string;
  /** a few fictional words of context, e.g. "First tattoo" */
  context?: string;
  /** a drawn placeholder - never a photograph of anyone */
  portrait?: { placeholder: true; initials: string };
  /** a synthetic voice reading the quote - never a person's recording */
  voice?: VoiceAudio & { synthetic: true };
  /**
   * a piece from Younes's portfolio shown beside it, to evaluate artwork in
   * the layout - captioned as a portfolio image, never as this (fictional)
   * person's tattoo
   */
  sampleWorkId?: string;
}

/**
 * The client experiences on the site, in one of three distinct states:
 * - 'awaiting'   nothing to show: the section renders nothing
 * - 'demo'       fictional entries, shown under a visible "demo content"
 *                label so the layout can be evaluated; replace before launch
 * - 'published'  approved client testimonials, each with its consent
 */
export type ClientExperiences =
  | { status: 'awaiting' }
  | { status: 'demo'; testimonials: [DemoTestimonial, ...DemoTestimonial[]] }
  | { status: 'published'; testimonials: [ClientTestimonial, ...ClientTestimonial[]] };
