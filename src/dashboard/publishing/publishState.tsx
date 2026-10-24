import { useState } from 'react';
import { errorText } from '../api';
import { useStudioItems } from './useStudioItems';
import { button } from '../ui';

/** one journal post, canvas call or testimonial as the studio holds it: whether it's on the site */
export interface StudioItem {
  id: string;
  slug?: string;
  title?: string;
  published: boolean;
  demo: boolean;
  // testimonials
  quote?: string;
  attribution?: string;
  context?: string | null;
  consent?: { date: string; via: string | null } | null;
}

/** "On the site" with a way to take it off, or put it back */
export function PublishSwitch({ item, onSet, what }: { item: StudioItem | undefined; onSet: (id: string, published: boolean) => Promise<void>; what: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!item) return null;
  const flip = async () => {
    if (item.published && !window.confirm(`Take this ${what} off the public site? It isn’t deleted - you can put it back.`)) return;
    setBusy(true);
    setProblem(null);
    try {
      await onSet(item.id, !item.published);
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span data-tone={item.published ? 'success' : 'neutral'} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-(--st-bg) px-2.5 text-[0.8125rem] font-semibold text-(--st-fg)">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
        {item.published ? 'On the site' : 'Off the site'}
      </span>
      <button type="button" disabled={busy} onClick={() => void flip()} className={button(item.published ? 'ghost' : 'primary', 'sm')}>
        {busy ? 'Saving…' : item.published ? 'Take off the site' : 'Put back on the site'}
      </button>
      {problem && (
        <span role="alert" data-tone="danger" className="text-[0.8125rem] font-semibold text-(--st-fg)">
          {problem}
        </span>
      )}
    </span>
  );
}

/** what was off the site when this page opened - the site's content doesn't carry it, so it's listed here */
export function OffSite({ items, known, onSet, what }: { items: StudioItem[]; known: Set<string>; onSet: (id: string, published: boolean) => Promise<void>; what: string }) {
  const off = items.filter((i) => !i.published && i.slug && !known.has(i.slug));
  if (!off.length) return null;
  return (
    <section aria-label={`Off the site`} className="border-t border-rule p-4">
      <h3 className="text-[0.8125rem] font-semibold text-ink-muted">Off the site</h3>
      <ul className="mt-2 grid gap-2">
        {off.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--studio-r-md) border border-rule px-3 py-2">
            <span className="min-w-0 truncate text-[0.875rem] font-semibold text-ink">
              {i.title}
              {i.demo && <span className="ml-2 text-[0.75rem] font-medium text-ink-muted">Sample</span>}
            </span>
            <PublishSwitch item={i} onSet={onSet} what={what} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** client words shown on the home page - each needs the client's consent on record */
export function TestimonialsCard() {
  const t = useStudioItems('testimonials');
  if (!t.list) return t.error ? <p className="studio-card p-4 text-[0.875rem] text-ink-muted">{t.error}</p> : null;
  return (
    <section aria-labelledby="testimonialsTitle" className="studio-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="testimonialsTitle" className="type-heading text-[1.05rem]">
          Client words
        </h2>
        <span className="text-[0.8125rem] text-ink-muted">Shown in “Client experiences” on the home page</span>
      </div>
      {t.list.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] text-ink-soft">None yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3 @min-[60rem]:grid-cols-2">
          {t.list.map((i) => (
            <li key={i.id} className="grid gap-2 rounded-(--studio-r-md) border border-rule p-3">
              <p className="text-[0.9375rem] leading-snug text-ink">“{i.quote}”</p>
              <p className="text-[0.8125rem] text-ink-muted">
                {i.attribution}
                {i.context ? ` · ${i.context}` : ''}
                {i.demo ? ' · Sample' : i.consent ? ` · consent ${i.consent.date}` : ''}
              </p>
              <PublishSwitch item={i} onSet={t.setPublished} what="testimonial" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
