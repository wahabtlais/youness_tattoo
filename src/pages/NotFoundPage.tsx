import { Link } from 'react-router';
import { StateMessage } from '../components/ui/StateMessage';

export function NotFoundPage() {
  return (
    <StateMessage
      kind="empty"
      className="min-h-svh justify-center px-page-x"
      title="There's nothing printed on this page."
      detail={
        <Link to="/" className="type-label text-ink underline decoration-burgundy underline-offset-4">
          Back to the studio
        </Link>
      }
    />
  );
}
