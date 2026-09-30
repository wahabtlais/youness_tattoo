import { useState } from 'react';
import { ConsultationTrigger } from '../components/Consultation/ConsultationTrigger';
import { ConsultationPanel } from '../components/Consultation/ConsultationPanel';
import { useInView } from '../hooks/useInView';
import './Book.css';

export function Book() {
  const [open, setOpen] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section className="book" id="book" aria-labelledby="bookHeading">
      <div className="book__inner" ref={ref} data-in={inView}>
        <span className="kicker">Your idea</span>
        <h2 id="bookHeading">Ready to make it yours?</h2>
        <p>Tell me what you're thinking — we'll take it from there.</p>
        <ConsultationTrigger onOpen={() => setOpen(true)} />
        <div className="book__legend">Beirut · by appointment</div>
      </div>

      <ConsultationPanel open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
