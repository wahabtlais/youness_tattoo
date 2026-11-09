import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { clientApi, ClientApiError, errorText } from '../client/api';
import { refreshClientSession, signedIn, useClientSession } from '../client/session';
import { PrivacyNotice } from '../components/consultation/PrivacyNotice';
import { RESUME_KEY } from '../components/consultation/consultationContext';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/**
 * A client's way in - on the site's own paper, under its masthead: sign
 * in, create an account, confirm the email, and the forgotten-password
 * pair. A sheet of paper-light on the page, like the consultation; beside
 * it, what an account is for, in a sentence each.
 *
 * Coming from the consultation (?return=/the/page), signing in leads back
 * there and the consultation reopens where it was. Nothing here says
 * whether an address has an account: registering and asking for a reset
 * answer the same either way.
 */

type Mode = 'signin' | 'register' | 'registered' | 'forgot' | 'forgot-sent' | 'reset' | 'verify';

/** only a path on this site, never an address elsewhere */
const safeReturn = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : null);

export function AccountPage() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const initial: Mode = pathname.endsWith('/verify') ? 'verify' : pathname.endsWith('/forgot') ? 'forgot' : pathname.endsWith('/reset') ? 'reset' : params.get('mode') === 'register' ? 'register' : 'signin';
  // a different address (sign in → forgot, …) starts that form afresh
  return <Account key={initial} initial={initial} params={params} />;
}

function Account({ initial, params }: { initial: Mode; params: URLSearchParams }) {
  const [mode, setMode] = useState<Mode>(initial);
  const returnTo = safeReturn(params.get('return'));
  const session = useClientSession();
  const account = signedIn(session);
  useDocumentTitle(mode === 'register' ? 'Create an account' : mode === 'signin' ? 'Sign in' : 'Your account');

  return (
    <section aria-labelledby="accountHeading" className="bg-paper px-page-x pt-[clamp(7rem,16vh,10rem)] pb-[clamp(4rem,12vh,7rem)]">
      <div className="mx-auto grid max-w-page items-start gap-x-[clamp(2rem,6vw,6rem)] gap-y-12 desktop:grid-cols-12">
        <div className="desktop:col-span-5 desktop:pt-6">
          <p className="type-meta text-ink-soft">
            <span className="text-burgundy">Your account</span> · Younes Tattoo
          </p>
          <h1 id="accountHeading" className="mt-4 max-w-[12ch] font-serif text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.98] tracking-[-0.015em] text-balance">
            {mode === 'register' ? (
              <>
                One place for <em className="text-burgundy">your tattoo.</em>
              </>
            ) : (
              <>
                Welcome <em className="text-burgundy">back.</em>
              </>
            )}
          </h1>
          <ol className="mt-8 grid max-w-[38ch] gap-0 border-t border-ink/20">
            {[
              ['Your idea', 'Send it to Younes, and follow his replies.'],
              ['Your project', 'The concept, references and placement, as they take shape.'],
              ['Your appointments', 'When, and how to prepare.'],
              ['Your aftercare', 'Younes’s instructions, day by day, and a place to show him how it heals.'],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-ink/20 py-3.5">
                <span className="type-meta text-burgundy">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="font-serif text-[1.15rem]">{t}</span>
                  <span className="mt-0.5 block text-micro leading-copy text-ink-soft">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="desktop:col-span-6 desktop:col-start-7">
          <div className="border border-rule bg-paper-light px-[clamp(1.25rem,4vw,3rem)] py-[clamp(1.75rem,4vw,3rem)] shadow-[0_24px_48px_-36px_rgb(20_19_26/0.5)]">
            {account && (mode === 'signin' || mode === 'register') ? (
              <SignedIn name={account.name} returnTo={returnTo} />
            ) : mode === 'signin' ? (
              <SignIn returnTo={returnTo} onMode={setMode} />
            ) : mode === 'register' ? (
              <Register returnTo={returnTo} onDone={() => setMode('registered')} onMode={setMode} />
            ) : mode === 'registered' ? (
              <CheckEmail />
            ) : mode === 'forgot' ? (
              <Forgot onDone={() => setMode('forgot-sent')} />
            ) : mode === 'forgot-sent' ? (
              <Sheet title="Check your inbox.">
                <p className="text-body leading-copy text-ink-soft">If there’s an account for that address, a link to choose a new password is on its way. It works for 30 minutes.</p>
                <BackToSignIn />
              </Sheet>
            ) : mode === 'reset' ? (
              <Reset token={params.get('token') ?? ''} />
            ) : (
              <Verify token={params.get('token') ?? ''} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), [title]);
  return (
    <>
      <h2 ref={h} tabIndex={-1} className="type-heading text-title italic outline-none">
        {title}
      </h2>
      <div className="mt-6 grid gap-6">{children}</div>
    </>
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="border-l-2 border-burgundy pl-3 text-body leading-copy text-burgundy">
      {text}
    </p>
  );
}

function BackToSignIn() {
  return (
    <p className="text-micro text-ink-soft">
      <Link to="/account" className="underline decoration-burgundy underline-offset-4 hover:text-burgundy">
        Back to sign in
      </Link>
    </p>
  );
}

/** after signing in: back where they came from (reopening the consultation), or to their account */
function useArrive(returnTo: string | null) {
  const navigate = useNavigate();
  return async () => {
    await refreshClientSession();
    if (returnTo) {
      try {
        sessionStorage.setItem(RESUME_KEY, '1');
      } catch {
        /* the consultation simply won't reopen by itself */
      }
      navigate(returnTo);
    } else navigate('/portal');
  };
}

function SignedIn({ name, returnTo }: { name: string; returnTo: string | null }) {
  const arrive = useArrive(returnTo);
  return (
    <Sheet title={`You’re signed in, ${name.split(' ')[0]}.`}>
      <div className="flex flex-wrap gap-4">
        <Button variant="primary" onClick={() => void arrive()}>
          {returnTo ? 'Continue' : 'Open your account'} <span aria-hidden="true">&rarr;</span>
        </Button>
      </div>
    </Sheet>
  );
}

function SignIn({ returnTo, onMode }: { returnTo: string | null; onMode: (m: Mode) => void }) {
  const arrive = useArrive(returnTo);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setUnverified(false);
    try {
      await clientApi('/login', { body: { email, password } });
      await arrive();
    } catch (err) {
      setUnverified(err instanceof ClientApiError && err.code === 'email_unverified');
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Sign in.">
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <TextField label={<span className="type-meta text-ink">Email</span>} type="email" autoComplete="email" required value={email} onChange={setEmail} />
        <TextField label={<span className="type-meta text-ink">Password</span>} type="password" autoComplete="current-password" required value={password} onChange={setPassword} />
        <Problem text={problem} />
        {unverified && (
          <p className="text-micro text-ink-soft">
            <Button
              variant="text"
              className="inline min-h-0 p-0 underline"
              onClick={async () => {
                await clientApi('/verify/resend', { body: { email } }).catch(() => undefined);
                setResent(true);
              }}
            >
              Send the confirmation link again
            </Button>
            {resent && <span role="status"> - sent, if the address needs one.</span>}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link to="/account/forgot" className="text-micro text-ink-soft underline decoration-burgundy underline-offset-4 hover:text-burgundy">
            Forgot your password?
          </Link>
        </div>
      </form>
      <p className="border-t border-rule pt-5 text-body text-ink-soft">
        New here?{' '}
        <Button variant="text" className="inline min-h-0 p-0 underline" onClick={() => onMode('register')}>
          Create an account
        </Button>
      </p>
    </Sheet>
  );
}

function Register({ onDone, onMode }: { returnTo: string | null; onDone: () => void; onMode: (m: Mode) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      await clientApi('/register', { body: { name, email, password, consent } });
      onDone();
    } catch (err) {
      setProblem(errorText(err));
      if (err instanceof ClientApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Create your account.">
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <TextField label={<span className="type-meta text-ink">Your name</span>} autoComplete="name" required value={name} onChange={setName} error={fields.name} />
        <TextField label={<span className="type-meta text-ink">Email</span>} type="email" autoComplete="email" required hint="Younes’s replies are announced here." value={email} onChange={setEmail} error={fields.email} />
        <TextField
          label={<span className="type-meta text-ink">Password</span>}
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters - a short sentence works well."
          value={password}
          onChange={setPassword}
          error={fields.password}
        />
        <div className="border-t border-rule pt-6">
          <PrivacyNotice />
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-body leading-copy text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={fields.consent ? true : undefined}
              aria-describedby={fields.consent ? 'registerConsentError' : undefined}
              className="mt-1 size-4 shrink-0 accent-burgundy"
            />
            <span>I’ve read how my details are used.</span>
          </label>
          {fields.consent && (
            <p id="registerConsentError" className="mt-1.5 text-micro leading-copy text-burgundy">
              {fields.consent}
            </p>
          )}
        </div>
        <Problem text={problem} />
        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </div>
      </form>
      <p className="border-t border-rule pt-5 text-body text-ink-soft">
        Already have one?{' '}
        <Button variant="text" className="inline min-h-0 p-0 underline" onClick={() => onMode('signin')}>
          Sign in
        </Button>
      </p>
    </Sheet>
  );
}

function CheckEmail() {
  return (
    <Sheet title="Check your inbox.">
      <p className="text-body leading-copy text-ink-soft">
        We’ve sent a link to confirm your email address. Open it and you’re in - it works for 48 hours. If you already had
        an account with this address, the email says so instead.
      </p>
      <p className="text-micro leading-copy text-ink-soft">Started a consultation? Your answers are kept in this tab - come back to it after confirming.</p>
      <BackToSignIn />
    </Sheet>
  );
}

function Forgot({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Sheet title="Choose a new password.">
      <form
        noValidate
        className="grid gap-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setProblem(null);
          try {
            await clientApi('/password/forgot', { body: { email } });
            onDone();
          } catch (err) {
            setProblem(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-body leading-copy text-ink-soft">Tell us the email you signed up with, and we’ll send a link to choose a new password.</p>
        <TextField label={<span className="type-meta text-ink">Email</span>} type="email" autoComplete="email" required value={email} onChange={setEmail} />
        <Problem text={problem} />
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send the link'}
          </Button>
          <BackToSignIn />
        </div>
      </form>
    </Sheet>
  );
}

function Reset({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (done) {
    return (
      <Sheet title="Your password is changed.">
        <p className="text-body leading-copy text-ink-soft">Every device was signed out. Sign in with your new password.</p>
        <BackToSignIn />
      </Sheet>
    );
  }
  return (
    <Sheet title="Choose a new password.">
      <form
        noValidate
        className="grid gap-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setProblem(null);
          try {
            await clientApi('/password/reset', { body: { token, password } });
            await refreshClientSession();
            setDone(true);
          } catch (err) {
            setProblem(err instanceof ClientApiError && err.fields.password ? err.fields.password : errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField
          label={<span className="type-meta text-ink">New password</span>}
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters."
          value={password}
          onChange={setPassword}
        />
        <Problem text={problem} />
        <div className="border-t border-rule pt-6">
          <Button variant="primary" type="submit" disabled={busy || !token}>
            {busy ? 'Saving…' : 'Save the new password'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** the link from the email: confirms the address and signs in */
function Verify({ token }: { token: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<'working' | 'failed'>('working');
  const [problem, setProblem] = useState<string | null>(null);
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    clientApi('/verify', { body: { token } })
      .then(async () => {
        await refreshClientSession();
        navigate('/portal', { replace: true, state: { welcome: true } });
      })
      .catch((e) => {
        setProblem(errorText(e));
        setState('failed');
      });
  }, [token, navigate]);
  if (state === 'working') {
    return (
      <Sheet title="Confirming your email…">
        <p role="status" className="text-body text-ink-soft">
          One moment.
        </p>
      </Sheet>
    );
  }
  return (
    <Sheet title="That link didn’t work.">
      <Problem text={problem} />
      <p className="text-body leading-copy text-ink-soft">Sign in and we’ll offer to send a fresh link.</p>
      <BackToSignIn />
    </Sheet>
  );
}
