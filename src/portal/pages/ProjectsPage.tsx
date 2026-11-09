import { Link, useParams } from 'react-router';
import { useConsultation } from '../../components/consultation/consultationContext';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Empty, ImageUpload, LoadState, PageTitle, PrivateImage, ProjectStages, SectionLabel, Sheet, StudioTime, TextLink, Thread, type Message } from '../ui';
import { dayLong, dayShort, usePortal } from '../usePortal';

interface ProjectCard {
  id: string;
  title: string;
  concept: string | null;
  placement: string | null;
  size: string | null;
  status: string;
  statusLabel: string;
  updatedAt: string;
  cover: string | null;
  unread: number;
}

interface Project extends Omit<ProjectCard, 'cover' | 'unread'> {
  timezone: string;
  description: string | null;
  createdAt: string;
  request: { id: string; ref: string } | null;
  media: { id: string; url: string; kind: 'reference' | 'design'; addedBy: 'you' | 'studio'; caption: string | null; at: string }[];
  appointments: { id: string; title: string; startsAt: string; endsAt: string; status: string; prep: string | null }[];
  aftercare: { startedOn: string; day: number } | null;
  messages: Message[];
}

/** every project, newest change first - each a sheet with its stage */
export function ProjectsPage() {
  useDocumentTitle('Your projects');
  const [state] = usePortal<ProjectCard[]>('/projects');
  const consultation = useConsultation();
  return (
    <div className="grid gap-10">
      <PageTitle eyebrow="Your account" title="Projects" />
      <LoadState state={state}>
        {(projects) =>
          projects.length === 0 ? (
            <Empty
              title="No projects yet."
              action={
                <Button variant="primary" onClick={() => consultation.open({ from: 'book' })}>
                  Start with your idea
                </Button>
              }
            >
              When Younes accepts an idea of yours, it becomes a project here - and you’ll follow it from design to healed.
            </Empty>
          ) : (
            <ul className="grid gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link to={`/portal/projects/${p.id}`} className="group block h-full border border-rule bg-paper-light transition-shadow hover:shadow-[0_20px_40px_-30px_rgb(20_19_26/0.6)]">
                    {p.cover ? (
                      <PrivateImage src={p.cover} alt="" ratio="5 / 3" />
                    ) : (
                      <span aria-hidden="true" className="grid aspect-[5/3] place-items-center bg-paper-deep type-meta text-ink-soft">
                        No images yet
                      </span>
                    )}
                    <span className="block p-5">
                      <span className="flex items-baseline justify-between gap-3 type-meta">
                        <span className="text-burgundy">{p.statusLabel}</span>
                        {p.unread > 0 && <span className="bg-burgundy px-1.5 text-paper">{p.unread} new</span>}
                      </span>
                      <span className="mt-2 block font-serif text-[1.6rem] leading-[1.1] group-hover:text-burgundy">{p.title}</span>
                      {(p.placement || p.size) && <span className="mt-2 block text-micro text-ink-soft">{[p.placement, p.size].filter(Boolean).join(' · ')}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </LoadState>
    </div>
  );
}

/**
 * One project: where it stands, what it is (concept, placement, size), the
 * images - theirs and Younes's - its appointments, and the conversation.
 * A booking can be asked for here; it stays a request until Younes sets a time.
 */
export function ProjectPage() {
  const { projectId } = useParams();
  const [state, reload] = usePortal<Project>(projectId ? `/projects/${projectId}` : null);
  useDocumentTitle(state.status === 'ready' ? state.data.title : 'Project');
  return (
    <LoadState state={state}>
      {(p) => (
        <div className="grid gap-[clamp(2rem,5vh,3rem)]">
          <PageTitle eyebrow={`Project · ${p.statusLabel}`} title={p.title}>
            {['design', 'ready-to-book'].includes(p.status) && (
              <Link
                to={`/portal/requests/new?project=${p.id}`}
                className="inline-flex min-h-12 items-center justify-center gap-3 border border-burgundy bg-burgundy px-6 py-3 type-label text-paper transition-colors hover:border-burgundy-deep hover:bg-burgundy-deep"
              >
                Ask to book a session <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </PageTitle>
          <ProjectStages status={p.status} />

          <div className="grid gap-6 desktop:grid-cols-12">
            <Sheet as="section" className="desktop:col-span-7">
              <SectionLabel>The idea</SectionLabel>
              <p className="mt-3 font-serif text-[clamp(1.3rem,2.2vw,1.65rem)] leading-snug">{p.concept ?? 'Younes will describe the concept here.'}</p>
              {p.description && <p className="mt-4 max-w-[60ch] text-body leading-copy whitespace-pre-line text-ink-soft">{p.description}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4">
                <div>
                  <dt className="type-meta text-ink-soft">Placement</dt>
                  <dd className="mt-1 text-body">{p.placement ?? 'To be agreed'}</dd>
                </div>
                <div>
                  <dt className="type-meta text-ink-soft">Approximate size</dt>
                  <dd className="mt-1 text-body">{p.size ?? 'To be agreed'}</dd>
                </div>
              </dl>
              {p.request && (
                <p className="mt-5 type-meta text-ink-soft">
                  From your request{' '}
                  <Link to={`/portal/requests/${p.request.id}`} className="text-ink underline decoration-burgundy underline-offset-4">
                    {p.request.ref}
                  </Link>
                </p>
              )}
            </Sheet>

            <Sheet as="section" className="desktop:col-span-5">
              <SectionLabel>Sessions</SectionLabel>
              {p.appointments.length === 0 ? (
                <p className="mt-3 text-body leading-copy text-ink-soft">No session yet. Younes proposes a time once the design is ready.</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {p.appointments.map((a) => (
                    <li key={a.id} className="border-t border-rule pt-3">
                      <p className="font-serif text-[1.25rem]">{dayLong(a.startsAt)}</p>
                      <StudioTime start={a.startsAt} end={a.endsAt} />
                      <p className="mt-1 type-meta text-ink-soft">{a.status === 'proposed' ? 'Proposed - see Appointments to accept or decline' : a.status}</p>
                    </li>
                  ))}
                </ul>
              )}
              {p.aftercare && (
                <div className="mt-5 border-t border-rule pt-4">
                  <SectionLabel>Healing</SectionLabel>
                  <p className="mt-2 text-body">
                    Day {Math.max(0, p.aftercare.day)} - since {dayShort(`${p.aftercare.startedOn}T12:00:00Z`)}
                  </p>
                  <div className="mt-2">
                    <TextLink to="/portal/aftercare">Your aftercare &rarr;</TextLink>
                  </div>
                </div>
              )}
            </Sheet>
          </div>

          <section aria-labelledby="images" className="grid gap-5">
            <SectionLabel id="images">Images · {p.media.length}</SectionLabel>
            {p.media.length > 0 && (
              <ul className="grid grid-cols-2 gap-4 tablet:grid-cols-3 desktop:grid-cols-4">
                {p.media.map((m) => (
                  <li key={m.id}>
                    <figure>
                      <PrivateImage src={m.url} alt={m.caption ?? (m.kind === 'design' ? 'A design from Younes' : 'Your reference image')} />
                      <figcaption className="mt-2 type-meta leading-snug text-ink-soft">
                        <span className={m.kind === 'design' ? 'text-burgundy' : 'text-ink'}>{m.kind === 'design' ? 'Design · Younes' : 'Reference · you'}</span>
                        {m.caption && <span className="mt-0.5 block normal-case">{m.caption}</span>}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
            <Sheet className="max-w-xl">
              <ImageUpload postTo={`/projects/${p.id}/references`} field="caption" label="Add a reference image" prompt="What should Younes notice in it? (optional)" onDone={reload} />
            </Sheet>
          </section>

          <section aria-labelledby="conversation" className="grid gap-5">
            <SectionLabel id="conversation">Conversation with Younes</SectionLabel>
            <Thread messages={p.messages} postTo={`/projects/${p.id}/messages`} onSent={reload} empty="No messages yet. Ask Younes anything about this project." />
          </section>
        </div>
      )}
    </LoadState>
  );
}
