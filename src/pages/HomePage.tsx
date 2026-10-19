import { useConsultation } from '../components/consultation/consultationContext';
import { FindSimilar } from '../components/find-similar/FindSimilar';
import { useOpenFindSimilar } from '../components/find-similar/useFindSimilarRoute';
import { Hero } from '../sections/Hero';
import { PhysicalWorkArchive } from '../components/work/physical-archive/PhysicalWorkArchive';
import { useWork } from '../hooks/useWork';
import { Studio } from '../sections/Studio';
import { Book } from '../sections/Book';

/** The landing page: discover Younes, his work, the studio, then the way in. */
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
      <Studio />
      <Book onOpen={() => consultation.open({ from: 'book' })} />
    </>
  );
}
