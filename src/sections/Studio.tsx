import geometric from '../assets/placeholders/geometric.svg';
import { useInView } from '../hooks/useInView';
import { STUDIO_COPY } from '../data/studio';
import './Studio.css';

/**
 * Editorial introduction to the artist. No biography exists yet, so
 * STUDIO_COPY carries only what's safe to say. The visual is an abstract
 * placeholder, not a stand-in photo - it doesn't pretend to be Younes.
 */
export function Studio() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section className="studio" id="studio" aria-labelledby="studioHeading">
      <div className="studio__inner" ref={ref} data-in={inView}>
        <div className="studio__text">
          <span className="kicker">{STUDIO_COPY.kicker}</span>
          <h2 id="studioHeading">
            {STUDIO_COPY.name}
            <br />
            <span>{STUDIO_COPY.role}</span>
          </h2>
          <p className="studio__statement">&ldquo;{STUDIO_COPY.statement}&rdquo;</p>
        </div>

        <div className="studio__visual" aria-hidden="true">
          <img src={geometric} alt="" />
          <span className="studio__visualNote">Placeholder — studio visual to come</span>
        </div>
      </div>
    </section>
  );
}
