import { Link, useLocation } from 'react-router';
import { useConsultation } from '../../components/consultation/consultationContext';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Empty, LoadState, PageTitle, ProjectStages, SectionLabel, Sheet, StudioTime, TextLink } from '../ui';
import { ago, dayLong, usePortal } from '../usePortal';

interface Overview {
  name: string;
  project: { id: string; title: string; status: string; statusLabel: string; placement: string | null; size: string | null; concept: string | null } | null;
  projects: number;
  openRequests: number;
  nextAppointment: { id: string; title: string; startsAt: string; endsAt: string; status: string; prep: string | null } | null;
  timezone: string;
  actions: { kind: string; text: string; href: string }[];
  recent: { at: string; text: string; href: string }[];
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

/**
 * The first thing a client sees: who they are to the studio right now - the
 * project in hand and where it stands, the next appointment, anything
 * waiting on them (in burgundy, first), and what changed lately. A new
 * account sees one clear way to begin.
 */
export function OverviewPage() {
  useDocumentTitle('Your account');
  const [state] = usePortal<Overview>('/overview');
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome;
  const consultation = useConsultation();

  return (
    <LoadState state={state}>
      {(o) => {
        const first = o.name.split(' ')[0];
        const fresh = !o.project && o.openRequests === 0 && o.recent.length === 0;
        return (
          <div className="grid gap-[clamp(2.5rem,6vh,4rem)]">
            <PageTitle
              eyebrow={welcome ? 'Your email is confirmed · welcome' : 'Your account'}
              title={
                <>
                  {greeting()}, <em className="text-burgundy">{first}.</em>
                </>
              }
            >
              <Button variant="primary" onClick={() => consultation.open({ from: 'book' })}>
                Start a new idea <span aria-hidden="true">&rarr;</span>
              </Button>
            </PageTitle>

            {fresh ? (
              <Empty
                title="Nothing here yet - it begins with your idea."
                action={
                  <Button variant="primary" onClick={() => consultation.open({ from: 'book' })}>
                    Tell Younes about your tattoo
                  </Button>
                }
              >
                Send Younes what you’re imagining. His replies, your project, your appointments and your aftercare will all appear here.
              </Empty>
            ) : (
              <>
                {o.actions.length > 0 && (
                  <section aria-labelledby="needsYou">
                    <SectionLabel id="needsYou">Waiting on you · {o.actions.length}</SectionLabel>
                    <ul className="mt-4 grid gap-2">
                      {o.actions.map((a) => (
                        <li key={a.text}>
                          <Link
                            to={a.href}
                            className="group flex min-h-14 items-center justify-between gap-6 border-l-2 border-burgundy bg-paper-light px-4 py-3 text-body leading-snug text-ink transition-colors hover:bg-paper-deep"
                          >
                            <span>{a.text}</span>
                            <span aria-hidden="true" className="shrink-0 text-burgundy transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
                              &rarr;
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="grid gap-6 desktop:grid-cols-12">
                  <section aria-labelledby="currentProject" className="desktop:col-span-7">
                    <Sheet className="h-full">
                      <SectionLabel id="currentProject">{o.projects > 1 ? `Your project · 1 of ${o.projects}` : 'Your project'}</SectionLabel>
                      {o.project ? (
                        <>
                          <h2 className="mt-4 font-serif text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.05] text-balance">
                            <Link to={`/portal/projects/${o.project.id}`} className="hover:text-burgundy">
                              {o.project.title}
                            </Link>
                          </h2>
                          {o.project.concept && <p className="mt-2 max-w-[52ch] text-body leading-copy text-ink-soft">{o.project.concept}</p>}
                          <div className="mt-6">
                            <ProjectStages status={o.project.status} />
                          </div>
                          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4">
                            <div>
                              <dt className="type-meta text-ink-soft">Placement</dt>
                              <dd className="mt-1 text-body">{o.project.placement ?? 'To be agreed'}</dd>
                            </div>
                            <div>
                              <dt className="type-meta text-ink-soft">Size</dt>
                              <dd className="mt-1 text-body">{o.project.size ?? 'To be agreed'}</dd>
                            </div>
                          </dl>
                          <div className="mt-4">
                            <TextLink to={`/portal/projects/${o.project.id}`}>
                              Open the project <span aria-hidden="true">&rarr;</span>
                            </TextLink>
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 text-body leading-copy text-ink-soft">
                          Once Younes accepts your idea, it becomes a project here - with its concept, references, placement and size.
                          {o.openRequests > 0 && ` You have ${o.openRequests} request${o.openRequests > 1 ? 's' : ''} with him.`}
                        </p>
                      )}
                    </Sheet>
                  </section>

                  <section aria-labelledby="nextAppointment" className="desktop:col-span-5">
                    <Sheet className="h-full">
                      <SectionLabel id="nextAppointment">Next appointment</SectionLabel>
                      {o.nextAppointment ? (
                        <>
                          <p className="mt-4 font-serif text-[clamp(1.7rem,3vw,2.3rem)] leading-[1.05]">{dayLong(o.nextAppointment.startsAt)}</p>
                          <StudioTime start={o.nextAppointment.startsAt} end={o.nextAppointment.endsAt} className="mt-2" />
                          <p className="mt-3 text-body text-ink-soft">{o.nextAppointment.title}</p>
                          <p className={o.nextAppointment.status === 'proposed' ? 'mt-3 type-meta text-burgundy' : 'mt-3 type-meta text-ink'}>
                            {o.nextAppointment.status === 'proposed' ? 'Proposed by Younes - not yet confirmed' : 'Confirmed'}
                          </p>
                          <div className="mt-4">
                            <TextLink to="/portal/appointments">
                              Details and preparation <span aria-hidden="true">&rarr;</span>
                            </TextLink>
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 text-body leading-copy text-ink-soft">Nothing booked yet. Younes proposes a time once your design is ready.</p>
                      )}
                    </Sheet>
                  </section>
                </div>

                {o.recent.length > 0 && (
                  <section aria-labelledby="recent">
                    <SectionLabel id="recent">Recently</SectionLabel>
                    <ol className="mt-4 border-t border-rule">
                      {o.recent.map((r) => (
                        <li key={`${r.at}-${r.text}`} className="border-b border-rule">
                          <Link to={r.href} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-6 py-3 hover:text-burgundy">
                            <span className="text-body">{r.text}</span>
                            <time dateTime={r.at} className="type-meta text-ink-soft">
                              {ago(r.at)}
                            </time>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )}
          </div>
        );
      }}
    </LoadState>
  );
}
