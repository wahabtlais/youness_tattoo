import { Outlet } from 'react-router';
import { useConsultation } from '../components/consultation/consultationContext';
import { FindSimilar } from '../components/find-similar/FindSimilar';
import { useOpenFindSimilar } from '../components/find-similar/useFindSimilarRoute';
import { Hero } from '../sections/Hero';
import { PhysicalWorkArchive } from '../components/work/physical-archive/PhysicalWorkArchive';
import { useWork } from '../hooks/useWork';
import { Artist } from '../sections/Artist';
import { ClientExperiences } from '../sections/ClientExperiences';
import { Process } from '../sections/Process';
import { JournalPreview } from '../sections/JournalPreview';
import { CanvasCallsPreview } from '../sections/CanvasCallsPreview';
import { Book } from '../sections/Book';

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

  return (
    <>
      <Hero onAsk={() => consultation.open({ from: 'hero' })} />
      {work.status === 'success' && (
        <PhysicalWorkArchive
          pieces={work.data}
          onFindSimilar={openFindSimilar}
        />
      )}
      {/* over the piece it was opened from; hands what was chosen to the consultation */}
      {work.status === 'success' && <FindSimilar pieces={work.data} onContinue={consultation.open} />}
      <Artist />
      <ClientExperiences />
      <Process onStart={() => consultation.open({ from: 'process' })} />
      <JournalPreview />
      <CanvasCallsPreview />
      <Book onOpen={() => consultation.open({ from: 'book' })} />
      {/* /work/:slug - says so when the piece doesn't exist (the archive opens real ones) */}
      <Outlet />
    </>
  );
}
