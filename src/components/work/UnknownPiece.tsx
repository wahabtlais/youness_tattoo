import { useNavigate, useParams } from 'react-router';
import { useWork } from '../../hooks/useWork';
import { NotFound } from '../layout/NotFound';
import { Dialog } from '../ui/Dialog';

/**
 * The element of /work/:slug (a child of the home page). For a real piece
 * it renders nothing - the archive opens the detail over itself. For a slug
 * that isn't in the archive it says so, over the home page, instead of
 * quietly dropping the visitor on the home page; closing (or Escape) goes
 * home.
 */
export function UnknownPiece() {
  const { slug } = useParams();
  const work = useWork();
  const navigate = useNavigate();
  const known = work.status !== 'success' || work.data.some((w) => w.slug === slug);
  if (known) return null;
  const home = () => navigate('/', { replace: true });
  return (
    <Dialog
      open
      onClose={home}
      labelledBy="notFoundTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto bg-paper p-0 text-ink backdrop:bg-paper"
    >
      <NotFound
        title="That piece isn’t in the archive."
        detail="The link may be mistyped, or the piece has been taken down."
        links={[
          { to: '/work', label: 'See all the work' },
          { to: '/', label: 'Back to the studio' },
        ]}
      />
    </Dialog>
  );
}
