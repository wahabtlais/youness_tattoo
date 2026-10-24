import { StateMessage } from '../components/ui/StateMessage';

/** anything a studio page throws while rendering: said plainly, with a way to try again */
export function DashboardError() {
  return (
    <StateMessage
      kind="error"
      className="min-h-svh justify-center bg-paper px-page-x"
      title="This part of the studio didn’t load."
      action={{ label: 'Try again', onClick: () => location.reload() }}
    />
  );
}
