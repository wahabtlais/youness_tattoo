/**
 * The client record (artist side - not used by the public site yet; see
 * docs/FUTURE_AI.md). A consultation is the first entry in a relationship,
 * not a disposable form:
 *
 *   Client -> consultations -> bookings -> tattoo -> aftercare -> next consultation
 */
import type { ClientContact } from './consultation';

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
