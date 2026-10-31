import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { SITE_CONTENT, type OptionalSection, type SiteContent } from '../data/siteContent';
import { published } from '../lib/publicContent';

/**
 * The home page's copy and optional sections.
 *
 * Visitors get the *published* content: what the server wrote into the
 * page (lib/publicContent), or - when the page carries none - the content
 * bundled with the site (data/siteContent.ts).
 *
 * `?sitePreview` asks for the studio's unpublished *draft* instead, from
 * the studio's private API: it loads only for the signed-in owner (their
 * session cookie), never for anyone else, and the page says it's a
 * preview the whole time (SitePreviewBanner).
 */

export const PREVIEW_PARAM = 'sitePreview';

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** any content, made safe: every field falls back to the bundled one, so nothing can blank the site */
export function sanitize(raw: unknown): SiteContent {
  const d = obj(raw);
  const p = SITE_CONTENT;
  const vis = obj(d.visible);
  const artist = obj(d.artist);
  const exp = obj(d.experiences);
  const proc = obj(d.process);
  const jour = obj(d.journal);
  const calls = obj(d.canvasCalls);
  const book = obj(d.book);
  const steps = Array.isArray(proc.steps) ? proc.steps : [];
  return {
    visible: Object.fromEntries((Object.keys(p.visible) as OptionalSection[]).map((k) => [k, typeof vis[k] === 'boolean' ? vis[k] : p.visible[k]])) as SiteContent['visible'],
    artist: {
      label: str(artist.label, p.artist.label),
      headline: str(artist.headline, p.artist.headline),
      meta: p.artist.meta.map((m, i) => str(Array.isArray(artist.meta) ? artist.meta[i] : undefined, m)),
      // the introduction may be empty: it's optional
      intro: Array.isArray(artist.intro) ? artist.intro.filter((x): x is string => typeof x === 'string' && !!x.trim()) : p.artist.intro,
    },
    experiences: { eyebrow: str(exp.eyebrow, p.experiences.eyebrow), heading: str(exp.heading, p.experiences.heading), intro: str(exp.intro, p.experiences.intro) },
    process: {
      eyebrow: str(proc.eyebrow, p.process.eyebrow),
      heading: str(proc.heading, p.process.heading),
      intro: str(proc.intro, p.process.intro),
      steps: p.process.steps.map((s, i) => ({ title: str(obj(steps[i]).title, s.title), body: str(obj(steps[i]).body, s.body) })),
      closing: str(proc.closing, p.process.closing),
    },
    journal: { eyebrow: str(jour.eyebrow, p.journal.eyebrow), heading: str(jour.heading, p.journal.heading), intro: str(jour.intro, p.journal.intro) },
    canvasCalls: { heading: str(calls.heading, p.canvasCalls.heading), intro: str(calls.intro, p.canvasCalls.intro) },
    book: { intro: str(book.intro, p.book.intro) },
  };
}

/** the published content: from the page, or the bundled content */
const PUBLISHED: SiteContent = (() => {
  const site = published()?.site;
  return site ? sanitize(site) : SITE_CONTENT;
})();

export type PreviewState = 'off' | 'loading' | 'ready' | 'signed-out' | 'error';

// one request per page, shared by every section that asks
let previewRequest: Promise<{ state: PreviewState; content?: SiteContent }> | null = null;
function loadPreview() {
  previewRequest ??= fetch('/api/studio/content/home/preview', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(async (r) => {
      if (r.status === 401 || r.status === 403) return { state: 'signed-out' as const };
      if (!r.ok) return { state: 'error' as const };
      const body = (await r.json()) as { site?: unknown };
      return { state: 'ready' as const, content: sanitize(body.site) };
    })
    .catch(() => ({ state: 'error' as const }));
  return previewRequest;
}

/** what the home page shows: the published content, or - previewing, signed in - the draft */
export function useSiteContent(): { content: SiteContent; preview: PreviewState } {
  const { search } = useLocation();
  const asked = new URLSearchParams(search).has(PREVIEW_PARAM);
  const [draft, setDraft] = useState<{ state: PreviewState; content?: SiteContent }>({ state: 'loading' });

  useEffect(() => {
    if (!asked) return;
    let live = true;
    void loadPreview().then((r) => {
      if (live) setDraft(r);
    });
    return () => {
      live = false;
    };
  }, [asked]);

  return useMemo(() => {
    if (!asked) return { content: PUBLISHED, preview: 'off' as const };
    return { content: draft.content ?? PUBLISHED, preview: draft.state };
  }, [asked, draft]);
}
