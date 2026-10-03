import { useConsultation } from '../components/consultation/consultationContext';
import { Hero } from '../sections/Hero';
import { Work } from '../sections/Work';
import { Studio } from '../sections/Studio';
import { Book } from '../sections/Book';

/** The landing page: discover Younes, his work, the studio, then the way in. */
export function HomePage() {
  const consultation = useConsultation();

  return (
    <>
      <Hero onAsk={() => consultation.open({ from: 'hero' })} />
      <Work
        onAsk={(workId) => consultation.open(workId ? { from: 'find-similar', workId } : { from: 'work' })}
      />
      <Studio />
      <Book onOpen={() => consultation.open({ from: 'book' })} />
    </>
  );
}
