import { ConsultationTrigger } from '../components/Consultation/ConsultationTrigger';
import { useInView } from '../hooks/useInView';
import './Book.css';

export function Book({ onOpen }: { onOpen: () => void }) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section className="book" id="book" aria-labelledby="bookHeading">
      <div className="book__inner" ref={ref} data-in={inView}>
        <img
          className="book__logo"
          src="/youness_tattoo_logo-640.webp"
          width={2129}
          height={739}
          alt="Younes Tattoo"
          loading="lazy"
          decoding="async"
        />
        <span className="kicker">Your idea</span>
        <h2 id="bookHeading">Ready to make it yours?</h2>
        <p>Tell me what you're thinking — we'll take it from there.</p>
        <ConsultationTrigger onOpen={onOpen} />
        <div className="book__legend">Detroit, Michigan · by appointment</div>
      </div>
    </section>
  );
}
