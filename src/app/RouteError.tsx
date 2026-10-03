import { isRouteErrorResponse, useRouteError } from 'react-router';
import { StateMessage } from '../components/ui/StateMessage';
import { NotFoundPage } from '../pages/NotFoundPage';

/** Anything a page throws while rendering lands here, inside the site frame. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <StateMessage
      kind="error"
      className="min-h-svh justify-center px-page-x"
      title="This page didn't print properly."
      action={{ label: 'Try again', onClick: () => location.reload() }}
    />
  );
}
