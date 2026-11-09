import { useState } from 'react';
import { Link } from 'react-router';
import { clientApi, errorText } from '../../client/api';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { Empty, LoadState, PageTitle, SectionLabel, Sheet, StudioTime } from '../ui';
import { dayLong, dayShort, usePortal } from '../usePortal';

interface Appointment {
  id: string;
  kind: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  prep: string | null;
  projectId: string | null;
  projectTitle: string | null;
}

const STATUS: Record<string, string> = { proposed: 'Proposed', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Missed' };

/**
 * Their appointments: what's ahead, large and plain - the day, the time
 * in the studio's own time zone, whether it's confirmed or only proposed
 * (a proposal is answered in the project's conversation), and how to
 * prepare, as Younes wrote it. Then what's passed.
 */
export function AppointmentsPage() {
  useDocumentTitle('Your appointments');
  const [state, reload] = usePortal<{ timezone: string; upcoming: Appointment[]; history: Appointment[] }>('/appointments');
  return (
    <div className="grid gap-10">
      <PageTitle eyebrow="Your account" title="Appointments" />
      <LoadState state={state}>
        {({ timezone, upcoming, history }) => (
          <>
            {upcoming.length === 0 ? (
              <Empty title="Nothing booked yet.">Younes proposes a time once your design is ready - it will appear here, with how to prepare.</Empty>
            ) : (
              <ul className="grid gap-6">
                {upcoming.map((a) => (
                  <Sheet as="li" key={a.id} className={cx('grid gap-6 desktop:grid-cols-12', a.status === 'proposed' && 'border-l-2 border-l-burgundy')}>
                    <div className="desktop:col-span-5">
                      <p className={cx('type-meta', a.status === 'proposed' ? 'text-burgundy' : 'text-ink')}>
                        {a.status === 'proposed' ? 'Proposed by Younes · not yet confirmed' : 'Confirmed'}
                      </p>
                      <p className="mt-3 font-serif text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.02]">{dayLong(a.startsAt, timezone)}</p>
                      <StudioTime start={a.startsAt} end={a.endsAt} className="mt-2" />
                      <p className="mt-3 text-body text-ink-soft">
                        {a.title}
                        {a.projectTitle && (
                          <>
                            {' · '}
                            <Link to={`/portal/projects/${a.projectId}`} className="underline decoration-burgundy underline-offset-4 hover:text-burgundy">
                              {a.projectTitle}
                            </Link>
                          </>
                        )}
                      </p>
                      {a.status === 'proposed' && <Answer id={a.id} projectId={a.projectId} onAnswered={reload} />}
                    </div>
                    <div className="border-rule desktop:col-span-7 desktop:border-l desktop:pl-8">
                      <SectionLabel>How to prepare</SectionLabel>
                      <p className="mt-3 max-w-[60ch] text-body leading-copy whitespace-pre-line">{a.prep ?? 'Younes will add any preparation notes here before the day.'}</p>
                    </div>
                  </Sheet>
                ))}
              </ul>
            )}

            {history.length > 0 && (
              <section aria-labelledby="past">
                <SectionLabel id="past">Earlier</SectionLabel>
                <ol className="mt-4 border-t border-rule">
                  {history.map((a) => (
                    <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-6 border-b border-rule py-3">
                      <span className="min-w-0">
                        <span className="block text-body">{a.title}</span>
                        <span className="type-meta text-ink-soft">{dayShort(a.startsAt, timezone)}</span>
                      </span>
                      <span className="type-meta text-ink-soft">{STATUS[a.status] ?? a.status}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </LoadState>
    </div>
  );
}

/**
 * Accept or decline a proposed time. Nothing is said to be confirmed until
 * the server has confirmed it (it checks the time is still free and still
 * proposed); declining asks once more before it goes.
 */
function Answer({ id, projectId, onAnswered }: { id: string; projectId: string | null; onAnswered: () => void }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function answer(accept: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      await clientApi(`/appointments/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      onAnswered();
    } catch (e) {
      setProblem(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 grid gap-3 border-t border-rule pt-4">
      <p className="text-body text-ink">Does this time work for you?</p>
      {asking ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
            {busy ? 'Declining…' : 'Yes, decline this time'}
          </Button>
          <Button variant="text" disabled={busy} onClick={() => setAsking(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>
            {busy ? 'Confirming…' : 'Accept this time'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setAsking(true)}>
            Decline
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-micro leading-copy text-burgundy">
          {problem}
        </p>
      )}
      {projectId && (
        <p className="text-micro leading-copy text-ink-soft">
          Need a different time?{' '}
          <Link to={`/portal/projects/${projectId}#conversation`} className="text-ink underline decoration-burgundy underline-offset-4">
            Write to Younes
          </Link>
          .
        </p>
      )}
    </div>
  );
}
