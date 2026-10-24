import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { cx } from '../../lib/cx';
import { api, ApiError, errorText } from '../api';
import { button, field } from '../ui';

/**
 * The sign-in screens, in the studio's own look: one centred panel each.
 * Errors are said in the panel (and read out); passwords are never echoed.
 */

export function AuthFrame({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <section aria-labelledby="authTitle" className="studio-card w-full max-w-[26rem] p-6">
        <p className="text-[0.8125rem] font-semibold text-ink-muted">Younes Tattoo · Private studio</p>
        <h1 id="authTitle" className="mt-1 studio-title text-[1.9rem] leading-tight">
          {title}
        </h1>
        {intro && <div className="mt-2 text-[0.9375rem] leading-snug text-ink-soft">{intro}</div>}
        {children && <div className="mt-5">{children}</div>}
      </section>
    </main>
  );
}

function Field({ label, type = 'text', value, onChange, autoComplete, error, hint, inputMode }: { label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete?: string; error?: string; hint?: string; inputMode?: 'numeric' | 'text' }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[0.875rem] font-semibold text-ink">
        {label}
      </label>
      {hint && <p className="text-[0.8125rem] text-ink-muted">{hint}</p>}
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        className={cx(field, 'mt-1.5 block h-10 w-full', error && 'border-(--st-solid)')}
        data-tone={error ? 'danger' : undefined}
      />
      {error && (
        <p id={`${id}-e`} data-tone="danger" className="mt-1 text-[0.8125rem] font-semibold text-(--st-fg)">
          {error}
        </p>
      )}
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" data-tone="danger" className="rounded-(--studio-r-md) bg-(--st-bg) px-3 py-2 text-[0.875rem] text-(--st-fg)">
      {text}
    </p>
  ) : null;
}

/** a form that sends once, shows the server's problem, and calls onDone on success */
function useSubmit<T>(run: () => Promise<T>, onDone: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      onDone(await run());
    } catch (err) {
      setProblem(errorText(err));
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, fields, submit };
}

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const login = useSubmit(() => api('/api/auth/login', { body: { email, password } }), onDone);
  const reset = useSubmit(() => api('/api/auth/password/forgot', { body: { email } }), () => setSent(true));

  if (forgot)
    return (
      <AuthFrame title="Reset your password" intro="Enter the studio’s email address. If it has an account, a link to choose a new password is sent there (valid for 30 minutes).">
        {sent ? (
          <p role="status" className="text-[0.9375rem] text-ink">
            If that address has an account, the email is on its way. Check the inbox - and the spam folder.
          </p>
        ) : (
          <form onSubmit={reset.submit} className="grid gap-4">
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={reset.fields.email} />
            <Problem text={reset.problem} />
            <button type="submit" disabled={reset.busy} className={button('primary')}>
              {reset.busy ? 'Sending…' : 'Send the link'}
            </button>
          </form>
        )}
        <button type="button" onClick={() => (setForgot(false), setSent(false))} className={button('ghost', 'sm', 'mt-3 -ml-3')}>
          Back to sign-in
        </button>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Sign in">
      <form onSubmit={login.submit} className="grid gap-4">
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} error={login.fields.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <Problem text={login.problem} />
        <button type="submit" disabled={login.busy || !email || !password} className={button('primary')}>
          {login.busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <button type="button" onClick={() => setForgot(true)} className={button('ghost', 'sm', 'mt-3 -ml-3')}>
        Forgot the password?
      </button>
    </AuthFrame>
  );
}

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState({ setupToken: '', name: '', email: '', password: '' });
  const s = useSubmit(() => api('/api/auth/setup', { body: v }), onDone);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <AuthFrame
      title="Set up the studio"
      intro={
        <>
          Create the owner’s account - once. You’ll need the setup token from the server (<code className="studio-code text-[0.8125rem]">OWNER_SETUP_TOKEN</code> in server/.env), or create the
          account on the server with <code className="studio-code text-[0.8125rem]">npm run owner:create</code>.
        </>
      }
    >
      <form onSubmit={s.submit} className="grid gap-4">
        <Field label="Setup token" type="password" autoComplete="off" value={v.setupToken} onChange={set('setupToken')} error={s.fields.setupToken} />
        <Field label="Your name" autoComplete="name" value={v.name} onChange={set('name')} error={s.fields.name} />
        <Field label="Email" type="email" autoComplete="username" value={v.email} onChange={set('email')} error={s.fields.email} />
        <Field label="Password" type="password" autoComplete="new-password" hint="At least 12 characters - a short sentence works well." value={v.password} onChange={set('password')} error={s.fields.password} />
        <Problem text={s.problem} />
        <button type="submit" disabled={s.busy} className={button('primary')}>
          {s.busy ? 'Creating…' : 'Create the owner account'}
        </button>
      </form>
    </AuthFrame>
  );
}

export function EnrollScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string; qrSvg: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api<{ secret: string; uri: string; qrSvg: string }>('/api/auth/mfa/enroll', { method: 'POST' })
      .then(setSetup)
      .catch((e) => setLoadError(errorText(e)));
  }, []);
  const s = useSubmit(() => api<{ recoveryCodes: string[] }>('/api/auth/mfa/enroll/confirm', { body: { code } }), (r) => setCodes(r.recoveryCodes));

  if (codes)
    return (
      <AuthFrame title="Keep these recovery codes" intro="If your phone is ever lost, each of these lets you sign in once. They won’t be shown again - print them or keep them somewhere safe, away from this computer.">
        <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-(--studio-r-md) bg-(--studio-sunken) p-3 studio-code text-[0.9375rem]">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <label className="mt-4 flex items-center gap-2.5 text-[0.9375rem] text-ink">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-(--studio-accent)" />
          I’ve saved them
        </label>
        <button type="button" disabled={!saved} onClick={onDone} className={button('primary', 'md', 'mt-4 w-full')}>
          Open the studio
        </button>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Set up two-factor sign-in" intro="The studio holds clients’ details, so signing in needs your phone too. Scan this with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows.">
      {loadError && <Problem text={loadError} />}
      {setup && (
        <>
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}`} alt="QR code for your authenticator app" width={192} height={192} className="mx-auto size-48 rounded-(--studio-r-md) bg-white p-2" />
          <details className="mt-3 text-[0.8125rem] text-ink-muted">
            <summary className="cursor-pointer">Can’t scan it? Enter this key instead</summary>
            <p className="mt-1 break-all studio-code text-ink">{setup.secret}</p>
          </details>
          <form onSubmit={s.submit} className="mt-4 grid gap-4">
            <Field label="Code from the app" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} error={s.fields.code} />
            <Problem text={s.problem} />
            <button type="submit" disabled={s.busy || code.replace(/\s/g, '').length !== 6} className={button('primary')}>
              {s.busy ? 'Checking…' : 'Turn on two-factor sign-in'}
            </button>
          </form>
        </>
      )}
      <button type="button" onClick={onCancel} className={button('ghost', 'sm', 'mt-3 -ml-3')}>
        Sign out
      </button>
    </AuthFrame>
  );
}

export function VerifyScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const s = useSubmit(
    () => api<{ recoveryCodesLeft?: number }>('/api/auth/mfa/verify', { body: { code } }),
    (r) => {
      if (r.recoveryCodesLeft !== undefined) setLeft(r.recoveryCodesLeft);
      else onDone();
    },
  );
  if (left !== null)
    return (
      <AuthFrame title="Signed in with a recovery code" intro={`That code is now used up. ${left} recovery code${left === 1 ? '' : 's'} left - if your phone is gone, set up two-factor again soon.`}>
        <button type="button" onClick={onDone} className={button('primary', 'md', 'w-full')}>
          Open the studio
        </button>
      </AuthFrame>
    );
  return (
    <AuthFrame title="Enter your code" intro="The 6-digit code from your authenticator app - or one of your recovery codes.">
      <form onSubmit={s.submit} className="grid gap-4">
        <Field label="Code" autoComplete="one-time-code" value={code} onChange={setCode} error={s.fields.code} />
        <Problem text={s.problem} />
        <button type="submit" disabled={s.busy || !code.trim()} className={button('primary')}>
          {s.busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <button type="button" onClick={onCancel} className={button('ghost', 'sm', 'mt-3 -ml-3')}>
        Sign out
      </button>
    </AuthFrame>
  );
}

export function ResetScreen({ onDone }: { onDone: () => void }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const s = useSubmit(() => api('/api/auth/password/reset', { body: { token, password } }), () => setDone(true));
  if (done)
    return (
      <AuthFrame title="Password changed" intro="Every device was signed out. Sign in again with the new password.">
        <a href="/studio" onClick={() => void onDone()} className={button('primary', 'md', 'w-full')}>
          Sign in
        </a>
      </AuthFrame>
    );
  return (
    <AuthFrame title="Choose a new password">
      {!token ? (
        <Problem text="This link is incomplete. Ask for a new one from the sign-in page." />
      ) : (
        <form onSubmit={s.submit} className="grid gap-4">
          <Field label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={password} onChange={setPassword} error={s.fields.password} />
          <Problem text={s.problem} />
          <button type="submit" disabled={s.busy} className={button('primary')}>
            {s.busy ? 'Saving…' : 'Save the new password'}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
