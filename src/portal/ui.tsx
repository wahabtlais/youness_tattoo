import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, STUDIO_TIME_ZONE, wallTime, zonedDate, zoneName, type ProjectStatus } from '@younes/contracts';
import { clientApi, errorText } from '../client/api';
import { Button } from '../components/ui/Button';
import { cx } from '../lib/cx';
import { ago, dayLong, localZone, time, type Loaded } from './usePortal';

/**
 * The portal's few parts, in the site's language: the paper ground, a
 * paper-light sheet for each object (a project, an appointment), serif
 * headings, mono labels, burgundy only where something wants attention.
 */

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-ink pb-6">
      <div className="min-w-0">
        <p className="type-meta text-ink-soft">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1] tracking-[-0.012em] text-balance">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

/** a paper-light object on the page */
export function Sheet({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cx('border border-rule bg-paper-light p-[clamp(1.1rem,2.6vw,1.75rem)]', className)}>{children}</As>;
}

export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="type-meta text-ink-soft">
      {children}
    </h2>
  );
}

/** a status, said in words and shown by weight: something for them to do is the burgundy one */
export function StatusPill({ label, tone }: { label: string; tone: 'waiting' | 'action' | 'good' | 'closed' }) {
  return (
    <span
      className={cx(
        'inline-flex min-h-7 items-center gap-2 px-2.5 type-meta leading-none whitespace-nowrap',
        tone === 'action' && 'bg-burgundy text-paper',
        tone === 'good' && 'bg-ink text-paper',
        tone === 'waiting' && 'border border-ink/40 text-ink',
        tone === 'closed' && 'border border-rule text-ink-soft',
      )}
    >
      {tone === 'action' && <span aria-hidden="true">●</span>}
      {label}
    </span>
  );
}

/** a project's stage among the stages - where it stands, at a glance (On hold sits outside the line) */
export function ProjectStages({ status }: { status: string }) {
  const line = PROJECT_STATUSES.filter((s) => s !== 'on-hold');
  const at = (line as readonly string[]).indexOf(status);
  if (status === 'on-hold') return <StatusPill label="On hold" tone="closed" />;
  return (
    <div>
      <ol aria-label={`Stage: ${PROJECT_STATUS_LABEL[status as ProjectStatus] ?? status}`} className="grid grid-cols-6 gap-1.5">
        {line.map((s, i) => (
          <li key={s} aria-current={i === at ? 'step' : undefined} className="min-w-0">
            <span aria-hidden="true" className={cx('block h-[3px]', i < at ? 'bg-ink' : i === at ? 'bg-burgundy' : 'bg-ink/12')} />
            {/* every stage named from tablets up - wrapping, never cut */}
            <span className={cx('mt-2 block type-meta leading-tight break-words max-tablet:sr-only', i === at ? 'text-burgundy' : i < at ? 'text-ink-soft' : 'text-ink-soft/70')}>
              {PROJECT_STATUS_LABEL[s]}
            </span>
          </li>
        ))}
      </ol>
      {/* phones: the stage in one plain line under the bars */}
      <p aria-hidden="true" className="mt-2 type-meta text-ink-soft tablet:hidden">
        <span className="text-burgundy">{PROJECT_STATUS_LABEL[status as ProjectStatus] ?? status}</span> · stage {at + 1} of {line.length}
      </p>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-ink/25 px-6 py-10 text-center">
      <p className="font-serif text-[1.5rem] leading-tight">{title}</p>
      {children && <p className="mx-auto mt-3 max-w-[44ch] text-body leading-copy text-ink-soft">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadState<T>({ state, children }: { state: Loaded<T>; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') {
    return (
      <p role="status" className="py-16 text-center type-meta text-ink-soft">
        Loading…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="border-l-2 border-burgundy py-2 pl-3 text-body text-burgundy">
        {state.message}
      </p>
    );
  }
  return <>{children(state.data)}</>;
}

export interface Message {
  id: string;
  from: 'studio' | 'you';
  body: string;
  at: string;
}

/** the conversation with Younes about one thing - a request or a project - and a reply */
export function Thread({ messages, postTo, onSent, empty }: { messages: Message[]; postTo: string; onSent: () => void; empty: string }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await clientApi(postTo, { body: { body } });
      setBody('');
      onSent();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-body leading-copy text-ink-soft">{empty}</p>
      ) : (
        <ol className="grid gap-4" aria-label="Messages">
          {messages.map((m) => (
            <li key={m.id} className={cx('max-w-[46rem]', m.from === 'you' && 'tablet:ml-auto')}>
              <div className={cx('px-4 py-3', m.from === 'studio' ? 'border-l-2 border-burgundy bg-paper-light' : 'border border-rule bg-paper')}>
                <p className="type-meta text-ink-soft">
                  <span className={m.from === 'studio' ? 'text-burgundy' : 'text-ink'}>{m.from === 'studio' ? 'Younes' : 'You'}</span> · <time dateTime={m.at}>{ago(m.at)}</time>
                </p>
                <p className="mt-1.5 text-body leading-copy whitespace-pre-line text-ink">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={send} className="mt-6 grid gap-3">
        <label htmlFor={`reply-${postTo}`} className="type-meta text-ink">
          Write to Younes
        </label>
        <textarea
          id={`reply-${postTo}`}
          rows={3}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full resize-y border border-ink/30 bg-paper px-3 py-2.5 text-body leading-copy text-ink focus:border-ink"
        />
        {problem && (
          <p role="alert" className="text-micro text-burgundy">
            {problem}
          </p>
        )}
        <div>
          <Button variant="primary" type="submit" disabled={busy || !body.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** add one image (and a line about it) - checked again by the server, which keeps it private */
export function ImageUpload({ postTo, field, label, prompt, onDone }: { postTo: string; field: 'caption' | 'note'; label: string; prompt: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const id = `upload-${postTo}`;
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setProblem('That image is too large - at most 20 MB.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const form = new FormData();
    form.append(field, text);
    form.append('file', file);
    try {
      await clientApi(postTo, { form });
      setFile(null);
      setText('');
      if (input.current) input.current.value = '';
      onDone();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="grid gap-3">
      <label htmlFor={id} className="type-meta text-ink">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-micro text-ink-soft file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-ink/55 file:bg-transparent file:px-4 file:type-label file:text-ink hover:file:bg-ink hover:file:text-paper"
      />
      <label htmlFor={`${id}-text`} className="sr-only">
        {prompt}
      </label>
      <input
        id={`${id}-text`}
        type="text"
        maxLength={field === 'note' ? 1000 : 300}
        placeholder={prompt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full border border-ink/30 bg-paper px-3 py-2.5 text-body text-ink focus:border-ink"
      />
      <p className="text-micro leading-copy text-ink-soft">JPEG, PNG, WebP or AVIF, up to 20 MB. Only you and Younes can see it.</p>
      {problem && (
        <p role="alert" className="text-micro text-burgundy">
          {problem}
        </p>
      )}
      <div>
        <Button variant="secondary" type="submit" disabled={busy || !file}>
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-2 type-label text-ink underline decoration-burgundy underline-offset-[7px] hover:text-burgundy">
      {children}
    </Link>
  );
}

/** a private image from the portal, by its address (never public) */
export function PrivateImage({ src, alt, className, ratio = '4 / 5' }: { src: string; alt: string; className?: string; ratio?: string }) {
  return (
    <span className={cx('block overflow-hidden bg-paper-deep', className)} style={{ aspectRatio: ratio }}>
      <img src={`${src}?w=640`} alt={alt} loading="lazy" decoding="async" className="block size-full object-cover" />
    </span>
  );
}

/**
 * An appointment's time, said plainly for someone who may be anywhere: the
 * studio's time in Detroit, named (EST or EDT, whichever is in force that
 * day), and - when their own clock reads differently - the same moment in
 * their time zone, with its day if that differs too.
 */
export function StudioTime({ start, end, withDay = false, className }: { start: string; end: string; withDay?: boolean; className?: string }) {
  const here = localZone();
  const same = (iso: string) => {
    const a = wallTime(iso, STUDIO_TIME_ZONE);
    const b = wallTime(iso, here);
    return zonedDate(iso, here) === zonedDate(iso, STUDIO_TIME_ZONE) && a.hour === b.hour && a.minute === b.minute;
  };
  const differs = !same(start) || !same(end);
  const otherDay = zonedDate(start, here) !== zonedDate(start, STUDIO_TIME_ZONE);
  return (
    <p className={cx('grid gap-1', className)}>
      <span className="type-meta text-ink">
        {withDay && `${dayLong(start)} · `}
        {time(start)} – {time(end)} · Detroit time ({zoneName(start)})
      </span>
      {differs && (
        <span className="type-meta text-ink-soft">
          {otherDay || withDay ? `${dayLong(start, here)} · ` : ''}
          {time(start, here)} – {time(end, here)} · your time ({zoneName(start, here)})
        </span>
      )}
    </p>
  );
}