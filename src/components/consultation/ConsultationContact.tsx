import { TextField } from '../ui/TextField';
import type { DraftContact } from './consultationDraft';
import { PrivacyNotice } from './PrivacyNotice';

interface ConsultationContactProps {
  contact: DraftContact;
  consent: boolean;
  errors: Partial<Record<keyof DraftContact | 'consent', string>>;
  onContact: (key: keyof DraftContact, value: string) => void;
  onConsent: (value: boolean) => void;
}

/**
 * How Younes can answer: a name and an email (required - he replies by
 * email), a phone number and Instagram if they'd rather. And their
 * agreement to how these details are used, with the notice itself one
 * click away rather than behind a link out of the consultation.
 */
export function ConsultationContact({ contact, consent, errors, onContact, onConsent }: ConsultationContactProps) {
  return (
    <div className="mt-7 flex flex-col gap-6">
      <TextField
        label={<span className="font-serif text-lede">Your name</span>}
        required
        autoComplete="name"
        value={contact.name}
        onChange={(v) => onContact('name', v)}
        error={errors.name}
      />
      <TextField
        label={<span className="font-serif text-lede">Your email</span>}
        required
        type="email"
        autoComplete="email"
        hint="Younes replies here."
        value={contact.email}
        onChange={(v) => onContact('email', v)}
        error={errors.email}
      />
      <div className="grid gap-6 tablet:grid-cols-2">
        <TextField
          label={<span className="type-meta text-ink">Phone</span>}
          optional
          type="tel"
          autoComplete="tel"
          value={contact.phone}
          onChange={(v) => onContact('phone', v)}
          error={errors.phone}
        />
        <TextField
          label={<span className="type-meta text-ink">Instagram</span>}
          optional
          autoComplete="off"
          placeholder="@yourname"
          value={contact.instagram}
          onChange={(v) => onContact('instagram', v)}
          error={errors.instagram}
        />
      </div>
      <div className="border-t border-rule pt-6">
        <PrivacyNotice />
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-body leading-copy text-ink">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'consentError' : undefined}
            className="mt-1 size-4 shrink-0 accent-burgundy"
          />
          <span>I’ve read how my details are used, and I’m happy for Younes to keep them to answer my idea.</span>
        </label>
        {errors.consent && (
          <p id="consentError" className="mt-1.5 text-micro leading-copy text-burgundy">
            {errors.consent}
          </p>
        )}
      </div>
    </div>
  );
}
