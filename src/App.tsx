import { useCallback, useState } from 'react';
import { Nav } from './components/Nav';
import { RegistrationMarks } from './components/RegistrationMarks';
import { ConsultationPanel } from './components/Consultation/ConsultationPanel';
import { Hero } from './sections/Hero';
import { Work } from './sections/Work';
import { Studio } from './sections/Studio';
import { Book } from './sections/Book';
import './App.css';

export default function App() {
  // one consultation shell, reachable from the hero, the work and booking
  const [consultOpen, setConsultOpen] = useState(false);
  const openConsult = useCallback(() => setConsultOpen(true), []);
  const closeConsult = useCallback(() => setConsultOpen(false), []);

  return (
    <div className="app">
      <Nav />
      <RegistrationMarks />
      <main>
        <Hero onAsk={openConsult} />
        <Work onAsk={openConsult} />
        <Studio />
        <Book onOpen={openConsult} />
      </main>
      <ConsultationPanel open={consultOpen} onClose={closeConsult} />
    </div>
  );
}
