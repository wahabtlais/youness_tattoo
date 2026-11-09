import { lazy, memo, Suspense, useCallback } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router';
import { useConsultation } from '../components/consultation/consultationContext';
import { useOpenFindSimilar } from '../components/find-similar/useFindSimilarRoute';
import { Hero } from '../sections/Hero';
import { useWork } from '../hooks/useWork';
import { Artist } from '../sections/Artist';
import { ClientExperiences } from '../sections/ClientExperiences';
import { Process } from '../sections/Process';
import { JournalPreview } from '../sections/JournalPreview';
import { CanvasCallsPreview } from '../sections/CanvasCallsPreview';
import { SitePreviewBanner } from '../components/layout/SitePreviewBanner';
import { useSiteContent } from '../hooks/useSiteContent';
import { useAfterFirstPaint, useAfterLoad } from '../hooks/useAfterLoad';

// The archive (with GSAP, which takes the prints down) mounts after the
// first paint, so its code arrives as its own file rather than with the page
const PhysicalWorkArchive = lazy(() =>
  import('../components/work/physical-archive/PhysicalWorkArchive').then((m) => ({ default: m.PhysicalWorkArchive })),
);

// Find Similar opens over a piece, never on arrival: its code loads once the
// page is idle - or at once, when the address already asks for it
const FindSimilar = lazy(() => import('../components/find-similar/FindSimilar').then((m) => ({ default: m.FindSimilar })));

/**
 * The landing page: discover Younes, his work, the artist behind it, what
 * clients say and how it goes - then what's new and what's open, and the
 * way in. The deeper browsing lives on /work, /journal and /canvas-calls.
 */
export function HomePage() {
  const consultation = useConsultation();
  // PROTOTYPE: the physical archive stands in for the Work section on this
  // branch; sections/Work.tsx is untouched and comes back by swapping this
  const work = useWork();
  const openFindSimilar = useOpenFindSimilar();
  // previewing the dashboard's draft: the banner says so
  const { preview } = useSiteContent();
  const idle = useAfterLoad();
  const findSimilarAsked = useSearchParams()[0].has('similar');
  // The first paint is the hero, which fills the screen. Everything below
  // the fold - the archive first - mounts right after: a phone has that much
  // less to build before it can show anything. Arriving at a piece
  // (/work/:slug) or a section (/#process), all render at once, so the detail
  // can open and the browser and ScrollManager can scroll to it.
  const { hash, pathname } = useLocation();
  const { open } = consultation;
  // stable: the hero doesn't re-render when the address changes under it
  const ask = useCallback(() => open({ from: 'hero' }), [open]);
  const below = useAfterFirstPaint(pathname !== '/' || (hash !== '' && hash !== '#hero'));

  return (
    <>
      <Hero onAsk={ask} />
      {below && work.status === 'success' && (
        <Suspense fallback={null}>
          <PhysicalWorkArchive pieces={work.data} onFindSimilar={openFindSimilar} />
        </Suspense>
      )}
      {/* over the piece it was opened from; hands what was chosen to the consultation */}
      {work.status === 'success' && (idle || findSimilarAsked) && (
        <Suspense fallback={null}>
          <FindSimilar pieces={work.data} onContinue={consultation.open} />
        </Suspense>
      )}
      {below && <BelowTheArchive />}
      {/* /work/:slug - says so when the piece doesn't exist (the archive opens real ones) */}
      <Outlet />
      {preview !== 'off' && <SitePreviewBanner state={preview} />}
    </>
  );
}

/**
 * Everything after the archive. Its own component, memoised and reading its
 * own data: opening a piece changes the address (/work/:slug), which
 * re-renders the home page in the same click - none of this depends on the
 * address, so none of it renders again (the detail opens that much sooner).
 */
const BelowTheArchive = memo(function BelowTheArchive() {
  const consultation = useConsultation();
  const show = useSiteContent().content.visible;
  return (
    <>
      {show.artist && <Artist />}
      {show.experiences && <ClientExperiences />}
      {show.process && <Process onStart={() => consultation.open({ from: 'process' })} />}
      {show.journal && <JournalPreview />}
      {show.canvasCalls && <CanvasCallsPreview />}
      {/* the booking invitation closes every page now, in the footer (#book) */}
    </>
  );
});
