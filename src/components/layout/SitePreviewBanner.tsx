import { Link } from 'react-router';
import type { PreviewState } from '../../hooks/useSiteContent';

const SAYS: Record<Exclude<PreviewState, 'off'>, string> = {
  loading: 'Loading the studio’s draft…',
  ready: 'Preview · the studio’s unpublished draft - visitors still see the published site',
  'signed-out': 'Preview unavailable - sign in to the studio in this browser to see the draft. Showing the published site.',
  error: 'The draft couldn’t be loaded. Showing the published site.',
};

/**
 * Shown only while the home page is asked for the studio's draft
 * (`/?sitePreview`): says what's on screen - the draft, or the published
 * site when the draft can't be shown - and leads back to the published
 * page. Visitors never see it.
 */
export function SitePreviewBanner({ state }: { state: Exclude<PreviewState, 'off'> }) {
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 bg-ink px-page-x py-3 text-center type-meta text-paper">
      <span>{SAYS[state]}</span>
      <Link to="/" className="underline decoration-paper/60 underline-offset-4 hover:decoration-paper">
        Leave preview
      </Link>
    </div>
  );
}
