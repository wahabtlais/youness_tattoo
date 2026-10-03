import { useCallback, useState } from 'react';
import { WorkGallery } from '../components/work/WorkGallery';
import { WorkViewer } from '../components/work/WorkViewer';
import { StateMessage } from '../components/ui/StateMessage';
import { useWork } from '../hooks/useWork';
import type { TattooWork } from '../domain/work';
import './Work.css';

const NO_PIECES: TattooWork[] = [];

interface WorkProps {
  /** opens the consultation - with the piece, when asked from one */
  onAsk: (workId?: string) => void;
}

/**
 * The archive, straight after the hero on the same paper. "THE WORK" is
 * set like the hero's name and the first print rises over it, the way the
 * portrait crosses YOUNES - the name gives way to the tattoos. Its arrival
 * is timed from the hero's scroll progress (--hero-p, see Hero).
 */
export function Work({ onAsk }: WorkProps) {
  const work = useWork();
  const pieces = work.status === 'success' ? work.data : NO_PIECES;
  const [open, setOpen] = useState<number | null>(null);

  const handleOpen = useCallback((piece: TattooWork) => setOpen(pieces.indexOf(piece)), [pieces]);
  const handleClose = useCallback(() => setOpen(null), []);
  const handleAsk = useCallback(
    (piece: TattooWork) => {
      setOpen(null);
      onAsk(piece.id);
    },
    [onAsk],
  );

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
          <span className="sr-only">The work - tattoos by Younes</span>
          <span className="work__word" aria-hidden="true">
            The W<span className="is-accent">o</span>rk
          </span>
        </h2>
        <p className="work__lede">
          Tattoos by Younes. <em>Selected pieces.</em>
        </p>
      </header>

      {work.status === 'loading' && <StateMessage kind="loading" title="The prints are being developed." />}
      {work.status === 'error' && (
        <StateMessage
          kind="error"
          title="The archive couldn't be loaded."
          action={work.retry && { label: 'Try again', onClick: work.retry }}
        />
      )}
      {work.status === 'success' && pieces.length === 0 && (
        <StateMessage kind="empty" title="New work is on its way." />
      )}

      {pieces.length > 0 && (
        <WorkGallery pieces={pieces} onOpen={handleOpen}>
          <p className="work__codaLine">
            Have a piece <em>in mind?</em>
          </p>
          <button type="button" className="work__ask unstyled" onClick={() => onAsk()}>
            <span className="work__askLine" aria-hidden="true" />
            Ask Younes
          </button>
        </WorkGallery>
      )}

      <WorkViewer pieces={pieces} index={open} onChange={setOpen} onClose={handleClose} onAsk={handleAsk} />
    </section>
  );
}
