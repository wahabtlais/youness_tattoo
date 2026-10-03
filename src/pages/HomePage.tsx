import { useConsultation } from '../components/consultation/consultationContext';
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

  return (
    <>
      <Hero onAsk={() => consultation.open({ from: 'hero' })} />
      {work.status === 'success' && (
        <PhysicalWorkArchive
          pieces={work.data}
          onFindSimilar={(workId) => consultation.open({ from: 'find-similar', workId })}
        />
      )}
      <Studio />
      <Book onOpen={() => consultation.open({ from: 'book' })} />
    </>
  );
}
