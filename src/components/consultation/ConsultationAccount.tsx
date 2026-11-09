import { useRef, useState } from 'react';
import { MAX_REQUEST_REFERENCES } from '@younes/contracts';
import { clientApi, errorText } from '../../client/api';
import { Link, useLocation } from 'react-router';
import { refreshClientSession } from '../../client/session';
import { Button } from '../ui/Button';
import { PrivacyNotice } from './PrivacyNotice';

/** where to come back to after signing in: this page, with the consultation reopened */
function useReturnTo() {
  const { pathname } = useLocation();
  return encodeURIComponent(pathname);
}

/**
 * Before the consultation: ideas are sent from a client account, so the
 * client can follow Younes's replies, their project and its aftercare in
 * one place. Signing in or creating an account comes back here, and the
 * consultation reopens where it was - nothing written is lost.
 */
export function AccountGate({ checking }: { checking: boolean }) {
  const back = useReturnTo();
  const [asked, setAsked] = useState(false);
  if (checking) {
    return (
      <p className="mt-2 type-meta text-ink-soft" role="status">
        One moment…
      </p>
    );
  }
  return (
    <>
      <h2 id="consultationTitle" tabIndex={-1} className="type-heading text-title italic outline-none">
        Your idea starts in your account.
      </h2>
      <p className="mt-3 max-w-measure text-body leading-copy text-ink-soft">
        Sign in, or create an account - it takes a minute. Younes replies there, and you can follow your project, your
        appointments and your aftercare in one place.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-rule pt-6">
        <Link
          to={`/account?mode=register&return=${back}`}
          className="inline-flex min-h-12 items-center justify-center gap-3 border border-burgundy bg-burgundy px-6 py-3 type-label text-paper transition-colors hover:border-burgundy-deep hover:bg-burgundy-deep"
        >
          Create an account
        </Link>
        <Link
          to={`/account?return=${back}`}
          className="inline-flex min-h-11 items-center justify-center gap-3 border border-ink/55 px-5 py-2.5 type-label text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-6 max-w-measure text-micro leading-copy text-ink-soft">
        Confirmed your email in another tab?{' '}
        <Button
          variant="text"
          className="inline min-h-0 p-0 underline"
          onClick={() => {
            setAsked(true);
            void refreshClientSession();
          }}
        >
          Continue here
        </Button>
        {asked && <span role="status"> - checking…</span>}
      </p>
    </>
  );
}

/**
 * The contact step for a signed-in client: their account's name and email
 * are how Younes answers (changed in their profile, not here), and their
 * agreement to how the consultation's details are used.
 */
export function AccountContact({
  account,
  consent,
  error,
  onConsent,
}: {
  account: { name: string; email: string };
  consent: boolean;
  error?: string;
  onConsent: (value: boolean) => void;
}) {
  return (
    <div className="mt-7 flex flex-col gap-6">
      <dl className="grid gap-4 border border-rule bg-paper px-5 py-4 tablet:grid-cols-2">
        <div>
          <dt className="type-meta text-ink-soft">Name</dt>
          <dd className="mt-1 font-serif text-lede">{account.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className="type-meta text-ink-soft">Email</dt>
          <dd className="mt-1 font-serif text-lede break-words">{account.email}</dd>
        </div>
      </dl>
      <p className="text-micro leading-copy text-ink-soft">
        Younes replies in your account and lets you know by email. A phone number or Instagram can be added in{' '}
        <Link to="/portal/profile" className="underline decoration-burgundy underline-offset-4">
          your profile
        </Link>
        .
      </p>
      <div className="border-t border-rule pt-6">
        <PrivacyNotice />
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-body leading-copy text-ink">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'consentError' : undefined}
            className="mt-1 size-4 shrink-0 accent-burgundy"
          />
          <span>I’ve read how my details are used, and I’m happy for Younes to keep them to answer my idea.</span>
        </label>
        {error && (
          <p id="consentError" className="mt-1.5 text-micro leading-copy text-burgundy">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Reference images with the idea - optional. Each is uploaded as it's
 * chosen (private: the server checks it's really an image, re-encodes it
 * and drops its metadata; only the client and Younes can open it) and goes
 * with the request when it's sent. Up to six; removing one here just
 * leaves it out (an image never sent is cleared from the server after a day).
 */
export function ConsultationUploads({ uploads, onChange }: { uploads: { id: string; url: string }[]; onChange: (next: { id: string; url: string }[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const room = MAX_REQUEST_REFERENCES - uploads.length;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setProblem(null);
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setProblem(`Up to ${MAX_REQUEST_REFERENCES} images - the first ${room} were added.`);
    let next = uploads;
    for (const file of chosen) {
      if (file.size > 20 * 1024 * 1024) {
        setProblem(`“${file.name}” is too large - at most 20 MB.`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await clientApi<{ id: string; url: string }>('/uploads', { form });
        next = [...next, r];
        onChange(next);
      } catch (e) {
        setProblem(errorText(e));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div className="grid gap-3">
      <p className="font-serif text-lede">
        Reference images <span className="type-meta text-ink-soft">optional</span>
      </p>
      <p className="text-micro leading-copy text-ink-soft">Anything that shows what you mean - a photo, a drawing, the spot on your body. Only you and Younes can see them.</p>
      {uploads.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Your reference images">
          {uploads.map((u, i) => (
            <li key={u.id} className="relative">
              <img src={`${u.url}?w=640`} alt={`Your reference image ${i + 1}`} className="size-24 border border-rule object-cover" />
              <button
                type="button"
                onClick={() => onChange(uploads.filter((x) => x.id !== u.id))}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-ink/40 bg-paper-light text-[0.9rem] leading-none text-ink hover:bg-ink hover:text-paper"
                aria-label={`Remove reference image ${i + 1}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <div>
          <label htmlFor="consultationReferences" className="inline-flex min-h-11 cursor-pointer items-center border border-ink/55 px-4 type-label text-ink hover:bg-ink hover:text-paper focus-within:outline">
            {busy ? 'Uploading…' : uploads.length ? 'Add more images' : 'Add images'}
            <input
              ref={input}
              id="consultationReferences"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => void add(e.target.files)}
            />
          </label>
          <span className="ml-3 text-micro text-ink-soft">JPEG, PNG, WebP or AVIF · up to 20 MB each · {room} more</span>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-micro text-burgundy">
          {problem}
        </p>
      )}
    </div>
  );
}
