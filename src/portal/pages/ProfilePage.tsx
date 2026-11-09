import { useState, type FormEvent } from 'react';
import { clientApi, ClientApiError, errorText } from '../../client/api';
import { refreshClientSession } from '../../client/session';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { LoadState, PageTitle, SectionLabel, Sheet } from '../ui';
import { dayShort, usePortal } from '../usePortal';

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  preferredContact: 'email' | 'phone' | 'instagram' | null;
}

/** their details as the studio keeps them, and their password */
export function ProfilePage() {
  useDocumentTitle('Your profile');
  const [state, reload] = usePortal<Profile>('/profile');
  return (
    <div className="grid max-w-3xl gap-10">
      <PageTitle eyebrow="Your account" title="Profile" />
      <LoadState state={state}>{(p) => <Details profile={p} onSaved={reload} />}</LoadState>
      <Password />
      <YourData />
    </div>
  );
}

function Details({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [instagram, setInstagram] = useState(profile.instagram ?? '');
  const [preferred, setPreferred] = useState(profile.preferredContact ?? 'email');
  const [busy, setBusy] = useState(false);
  /** what was last saved: "Saved" shows until something changes */
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const now = JSON.stringify([name, phone, instagram, preferred]);
  const saved = savedAs === now;
  const [problem, setProblem] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      await clientApi('/profile', { method: 'PATCH', body: { name, phone, instagram, preferredContact: preferred } });
      await refreshClientSession();
      setSavedAs(now);
      onSaved();
    } catch (err) {
      setProblem(errorText(err));
      if (err instanceof ClientApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet as="section">
      <SectionLabel>Your details</SectionLabel>
      <form onSubmit={submit} noValidate className="mt-5 grid gap-6">
        <TextField label={<span className="type-meta text-ink">Name</span>} autoComplete="name" required value={name} onChange={setName} error={fields.name} />
        <div className="grid gap-1">
          <p className="type-meta text-ink">Email</p>
          <p className="text-body">{profile.email}</p>
          <p className="text-micro text-ink-soft">The address you sign in with. To change it, ask Younes.</p>
        </div>
        <div className="grid gap-6 tablet:grid-cols-2">
          <TextField label={<span className="type-meta text-ink">Phone</span>} optional type="tel" autoComplete="tel" value={phone} onChange={setPhone} error={fields.phone} />
          <TextField label={<span className="type-meta text-ink">Instagram</span>} optional placeholder="@yourname" value={instagram} onChange={setInstagram} error={fields.instagram} />
        </div>
        <fieldset className="grid gap-2">
          <legend className="type-meta text-ink">How you’d rather hear from Younes</legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {(['email', 'phone', 'instagram'] as const).map((v) => (
              <label key={v} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-body">
                <input type="radio" name="preferred" value={v} checked={preferred === v} onChange={() => setPreferred(v)} className="accent-burgundy" />
                {v === 'email' ? 'Email' : v === 'phone' ? 'Phone' : 'Instagram'}
              </label>
            ))}
          </div>
        </fieldset>
        {problem && (
          <p role="alert" className="text-body text-burgundy">
            {problem}
          </p>
        )}
        <div className="flex items-center gap-4 border-t border-rule pt-6">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
            <span role="status" className="type-meta text-ink-soft">
              Saved
            </span>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function Password() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setFields({});
    try {
      await clientApi('/password/change', { body: { current, password: next } });
      setDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      setProblem(errorText(err));
      if (err instanceof ClientApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet as="section">
      <SectionLabel>Password</SectionLabel>
      <form onSubmit={submit} noValidate className="mt-5 grid gap-6">
        <TextField label={<span className="type-meta text-ink">Current password</span>} type="password" autoComplete="current-password" value={current} onChange={setCurrent} error={fields.current} />
        <TextField label={<span className="type-meta text-ink">New password</span>} type="password" autoComplete="new-password" hint="At least 12 characters. Your other devices will be signed out." value={next} onChange={setNext} error={fields.password} />
        {problem && !Object.keys(fields).length && (
          <p role="alert" className="text-body text-burgundy">
            {problem}
          </p>
        )}
        <div className="flex items-center gap-4 border-t border-rule pt-6">
          <Button variant="secondary" type="submit" disabled={busy || !current || !next}>
            {busy ? 'Changing…' : 'Change password'}
          </Button>
          {done && (
            <span role="status" className="type-meta text-ink-soft">
              Changed
            </span>
          )}
        </div>
      </form>
    </Sheet>
  );
}

interface DataSummary {
  account: { email: string; name: string; createdAt: string; verifiedAt: string | null };
  counts: { requests: number; messages: number; projects: number; referenceImages: number; healingPhotos: number; appointments: number; aftercarePlans: number };
  retained: string[];
  deletion: { status: 'pending' | 'completed' | 'cancelled'; requestedAt: string; resolvedAt: string | null; resolution: string | null } | null;
}

/**
 * Their data: what the studio holds about them, a copy of it (a JSON file),
 * and asking for the account to be closed - which Younes reviews; nothing
 * is deleted automatically, and what's kept, and why, is said before they ask.
 */
function YourData() {
  const [state, reload] = usePortal<DataSummary>('/account/data');
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function act(method: 'POST' | 'DELETE') {
    setBusy(true);
    setProblem(null);
    try {
      await clientApi('/account/deletion', method === 'POST' ? { body: { confirm, reason: reason || undefined } } : { method: 'DELETE' });
      setConfirm(false);
      setReason('');
      reload();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet as="section">
      <SectionLabel>Your data</SectionLabel>
      <LoadState state={state}>
        {(d) => (
          <div className="mt-5 grid gap-6">
            <div>
              <p className="text-body leading-copy text-ink-soft">What Younes Tattoo holds about you:</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 tablet:grid-cols-4">
                {(
                  [
                    ['Requests', d.counts.requests],
                    ['Messages', d.counts.messages],
                    ['Projects', d.counts.projects],
                    ['Your images', d.counts.referenceImages],
                    ['Healing photos', d.counts.healingPhotos],
                    ['Appointments', d.counts.appointments],
                    ['Aftercare', d.counts.aftercarePlans],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="border-t border-rule pt-2">
                    <dt className="type-meta text-ink-soft">{k}</dt>
                    <dd className="font-serif text-[1.4rem]">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-micro text-ink-soft">Plus your account ({d.account.email}) and the details in your profile.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
              <a href="/api/client/account/export" download className="inline-flex min-h-11 items-center border border-ink/55 px-5 type-label text-ink hover:bg-ink hover:text-paper">
                Download a copy of your data
              </a>
              <span className="text-micro text-ink-soft">A JSON file with everything above.</span>
            </div>

            <div className="grid gap-3 border-t border-rule pt-5">
              <p className="type-meta text-ink">Closing your account</p>
              {d.deletion?.status === 'pending' ? (
                <>
                  <p role="status" className="text-body leading-copy">
                    You asked for your account to be closed on {dayShort(d.deletion.requestedAt)}. Younes will review it - your account keeps working until he does.
                  </p>
                  <div>
                    <Button variant="secondary" disabled={busy} onClick={() => void act('DELETE')}>
                      Withdraw the request
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-body leading-copy text-ink-soft">
                    You can ask for your account to be closed. Younes reviews each request. Closing stops your account working - you’ll be signed out everywhere. Some
                    records are kept for now, because the studio’s retention policy is still being decided:
                  </p>
                  <ul className="grid list-disc gap-1 pl-5 text-body leading-copy text-ink-soft">
                    {d.retained.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {d.deletion?.status === 'completed' && <p className="text-micro text-ink-soft">{d.deletion.resolution}</p>}
                  <label htmlFor="closeReason" className="type-meta text-ink">
                    Anything Younes should know <span className="text-ink-soft">(optional)</span>
                  </label>
                  <textarea
                    id="closeReason"
                    rows={2}
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="border border-ink/30 bg-paper px-3 py-2 text-body text-ink focus:border-ink"
                  />
                  <label className="flex cursor-pointer items-start gap-3 text-body leading-copy">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 size-4 shrink-0 accent-burgundy" />
                    <span>I understand what closing my account means.</span>
                  </label>
                  <div>
                    <Button variant="secondary" disabled={busy || !confirm} onClick={() => void act('POST')}>
                      Ask to close my account
                    </Button>
                  </div>
                </>
              )}
              {problem && (
                <p role="alert" className="text-micro text-burgundy">
                  {problem}
                </p>
              )}
            </div>
          </div>
        )}
      </LoadState>
    </Sheet>
  );
}
