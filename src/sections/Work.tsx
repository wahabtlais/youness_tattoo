import { useCallback, useState } from 'react';
import { WorkGallery } from '../components/work/WorkGallery';
import { WorkViewer } from '../components/work/WorkViewer';
import { WORK, type WorkPiece } from '../data/work';
import './Work.css';

interface WorkProps {
  /** opens the Ask Younes consultation shell */
  onAsk: () => void;
}

/**
 * The archive, straight after the hero on the same paper. "THE WORK" is
 * set like the hero's name and the first print rises over it, the way the
 * portrait crosses YOUNES - the name gives way to the tattoos. Its arrival
 * is timed from the hero's scroll progress (--hero-p, see Hero).
 */
export function Work({ onAsk }: WorkProps) {
  const [open, setOpen] = useState<number | null>(null);

  const handleOpen = useCallback((piece: WorkPiece) => setOpen(WORK.indexOf(piece)), []);
  const handleClose = useCallback(() => setOpen(null), []);
  const handleAsk = useCallback(() => {
    setOpen(null);
    onAsk();
  }, [onAsk]);

  return (
    <section className="work" id="work" aria-labelledby="workTitle">
      <span className="work__rule" aria-hidden="true">
        <b>02</b>
      </span>

      <header className="work__head">
        <p className="work__kicker">
          <span>Tattoo work</span>
          <span>Detroit, Michigan</span>
        </p>
        <h2 className="work__title" id="workTitle">
          <span className="visually-hidden">The work - tattoos by Younes</span>
          <span className="work__word" aria-hidden="true">
            The W<span className="is-accent">o</span>rk
          </span>
        </h2>
        <p className="work__lede">
          Tattoos by Younes. <em>Selected pieces.</em>
        </p>
      </header>

      <WorkGallery pieces={WORK} onOpen={handleOpen}>
        <p className="work__codaLine">
          Have a piece <em>in mind?</em>
        </p>
        <button type="button" className="work__ask unstyled" onClick={onAsk}>
          <span className="work__askLine" aria-hidden="true" />
          Ask Younes
        </button>
      </WorkGallery>

      <WorkViewer pieces={WORK} index={open} onChange={setOpen} onClose={handleClose} onAsk={handleAsk} />
    </section>
  );
}
