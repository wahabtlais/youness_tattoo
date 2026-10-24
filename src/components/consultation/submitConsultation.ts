import { contactSchema, PRIVACY_NOTICE_VERSION, type ConsultationReceipt } from '@younes/contracts';
import type { DraftContact, DraftState } from './consultationDraft';

/**
 * Sending a finished consultation to the studio's server
 * (POST /api/public/consultations). It is "sent" only when the server
 * answers with a receipt - after it has stored the consultation. Every
 * other outcome says what happened and keeps the draft, so nothing the
 * client wrote is lost: a validation problem (with the fields), too many
 * tries, or no connection at all.
 */

type FieldErrors = Partial<Record<keyof DraftContact | 'consent', string>>;

export type SendResult = { ok: true; receipt: ConsultationReceipt } | { ok: false; message: string; fields?: FieldErrors };

/** the contact step's own check, before anything is sent */
export function checkContact(contact: DraftContact, consent: boolean) {
  const fields: FieldErrors = {};
  const r = contactSchema.safeParse(contact);
  if (!r.success) for (const i of r.error.issues) fields[i.path[0] as keyof DraftContact] ??= i.message;
  if (!consent) fields.consent = 'Please confirm you’ve read how your details are used';
  return fields;
}

export async function sendConsultation(draft: DraftState): Promise<SendResult> {
  const { consultation, contact } = draft;
  const { references: _ignored, ...answers } = consultation.summary;
  void _ignored;
  const body = {
    idempotencyKey: draft.submissionKey,
    entry: consultation.entry,
    summary: answers,
    contact: { name: contact.name, email: contact.email, phone: contact.phone || undefined, instagram: contact.instagram || undefined },
    consent: draft.consent,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    website: '',
    startedAt: draft.startedAt,
  };
  let res: Response;
  try {
    res = await fetch('/api/public/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, message: 'Your idea couldn’t reach the studio - check your connection and try again. Nothing was sent, and your answers are still here.' };
  }
  if (res.status === 201 || res.status === 200) return { ok: true, receipt: (await res.json()) as ConsultationReceipt };
  const problem = (await res.json().catch(() => null)) as { title?: string; fields?: Record<string, string> } | null;
  if (res.status === 400 && problem?.fields) {
    const fields: FieldErrors = {};
    for (const [k, v] of Object.entries(problem.fields)) {
      const key = k.replace(/^contact\./, '');
      if (key === 'name' || key === 'email' || key === 'phone' || key === 'instagram' || key === 'consent') fields[key] = v;
    }
    return { ok: false, message: problem.title ?? 'Some details need another look.', fields };
  }
  if (res.status === 429) return { ok: false, message: 'Too many consultations were sent from here just now. Please wait a few minutes and try again - your answers are still here.' };
  return { ok: false, message: 'Something went wrong on the studio’s side and nothing was sent. Please try again in a moment - your answers are still here.' };
}
