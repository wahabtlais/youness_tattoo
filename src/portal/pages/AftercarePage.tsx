import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { Empty, ImageUpload, LoadState, PageTitle, PrivateImage, SectionLabel, Sheet } from '../ui';
import { ago, dayShort, usePortal } from '../usePortal';

interface Step {
  dayFrom: number;
  dayTo: number | null;
  title: string;
  body: string;
  state: 'past' | 'current' | 'upcoming';
}
interface Plan {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  intro: string | null;
  startedOn: string;
  day: number;
  reminders: boolean;
  steps: Step[];
  photos: { id: string; url: string; note: string | null; at: string; day: number; response: string | null; respondedAt: string | null }[];
}

const days = (s: { dayFrom: number; dayTo: number | null }) => (s.dayTo === null ? `Day ${s.dayFrom} onward` : s.dayTo === s.dayFrom ? `Day ${s.dayFrom}` : `Days ${s.dayFrom}–${s.dayTo}`);
const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');

/**
 * Aftercare: for each healing piece, the instructions Younes wrote and
 * approved - nothing else is shown as advice - set out by the days of
 * healing, today's stage marked on the line (the Process chapter's own
 * device: a large numeral, a stitched line). Under it, a place to send him
 * a photo of how it's healing, and his answers.
 */
export function AftercarePage() {
  useDocumentTitle('Your aftercare');
  const [state, reload] = usePortal<{ today: string; plans: Plan[]; waiting: { projectId: string; projectTitle: string }[] }>('/aftercare');
  return (
    <div className="grid gap-10">
      <PageTitle eyebrow="Your account" title="Aftercare" />
      <LoadState state={state}>
        {({ plans, waiting }) => (
          <>
            {plans.length === 0 && waiting.length === 0 && (
              <Empty title="Aftercare appears here after your session.">Younes gives each finished piece its own instructions, day by day - and you can show him how it’s healing.</Empty>
            )}
            {waiting.map((w) => (
              <Sheet key={w.projectId}>
                <p className="font-serif text-[1.35rem]">{w.projectTitle}</p>
                <p className="mt-2 text-body text-ink-soft">Younes will add the aftercare for this piece here.</p>
              </Sheet>
            ))}
            {plans.map((p) => (
              <article key={p.id} aria-labelledby={`plan-${p.id}`} className="grid gap-8">
                <div className="grid gap-6 border-b border-ink pb-8 desktop:grid-cols-12 desktop:items-end">
                  <div className="desktop:col-span-8">
                    <p className="type-meta text-ink-soft">
                      {p.projectTitle} · since {dayShort(`${p.startedOn}T12:00:00Z`)}
                    </p>
                    <h2 id={`plan-${p.id}`} className="mt-3 font-serif text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.05] text-balance">
                      {p.title}
                    </h2>
                    {p.intro && <p className="mt-3 max-w-[60ch] text-body leading-copy whitespace-pre-line text-ink-soft">{p.intro}</p>}
                  </div>
                  <p className="desktop:col-span-4 desktop:text-right" aria-label={p.day < 0 ? `Healing starts in ${-p.day} days` : `Healing day ${p.day}`}>
                    <span aria-hidden="true" className="block font-serif text-[clamp(4.5rem,9vw,7.5rem)] leading-[0.82] text-burgundy">
                      {two(p.day)}
                    </span>
                    <span aria-hidden="true" className="mt-2 block type-meta text-ink-soft">
                      {p.day < 0 ? 'days to go' : 'day of healing'}
                    </span>
                  </p>
                </div>

                <ol className="relative grid gap-0">
                  {p.steps.map((s, i) => (
                    <li key={i} aria-current={s.state === 'current' ? 'step' : undefined} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0">
                      {/* the stitched line, solid where healing has passed */}
                      {i < p.steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={cx('absolute top-5 bottom-0 left-[1.25rem] w-px', s.state === 'past' ? 'bg-burgundy' : '[background:repeating-linear-gradient(to_bottom,var(--color-burgundy)_0_6px,transparent_6px_12px)] opacity-50')}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'relative z-1 mt-1.5 ml-[0.85rem] size-[0.8rem] rotate-45 border-[1.5px] border-burgundy',
                          s.state === 'upcoming' ? 'bg-paper' : 'bg-burgundy',
                          s.state === 'current' && 'shadow-[0_0_0_6px_rgb(122_29_37/0.14)]',
                        )}
                      />
                      <div className={cx(s.state === 'current' ? 'border border-rule bg-paper-light p-5' : 'pb-1', s.state === 'upcoming' && 'text-ink-soft')}>
                        <p className={cx('type-meta', s.state === 'current' ? 'text-burgundy' : 'text-ink-soft')}>
                          {days(s)}
                          {s.state === 'current' && ' · now'}
                          {s.state === 'past' && ' · done'}
                        </p>
                        <h3 className="mt-1.5 font-serif text-[1.4rem] leading-tight">{s.title}</h3>
                        {s.state !== 'past' ? (
                          <p className="mt-2 max-w-[62ch] text-body leading-copy whitespace-pre-line">{s.body}</p>
                        ) : (
                          <details className="mt-1">
                            <summary className="cursor-pointer type-meta text-ink-soft">Read again</summary>
                            <p className="mt-2 max-w-[62ch] text-body leading-copy whitespace-pre-line">{s.body}</p>
                          </details>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="type-meta text-ink-soft">
                  Written by Younes for this piece.
                  {p.reminders && ' You’ll get an email as you reach each stage.'}
                </p>

                <section aria-labelledby={`photos-${p.id}`} className="grid gap-6 desktop:grid-cols-12">
                  <div className="desktop:col-span-4">
                    <SectionLabel id={`photos-${p.id}`}>Show Younes how it’s healing</SectionLabel>
                    <Sheet className="mt-4">
                      <ImageUpload postTo={`/projects/${p.projectId}/healing-photos`} field="note" label="A photo of your tattoo today" prompt="How does it feel? (optional)" onDone={reload} />
                    </Sheet>
                  </div>
                  <div className="desktop:col-span-8">
                    <SectionLabel>Your photos · {p.photos.length}</SectionLabel>
                    {p.photos.length === 0 ? (
                      <p className="mt-4 text-body text-ink-soft">None yet. Younes sees each one and answers here.</p>
                    ) : (
                      <ul className="mt-4 grid gap-4">
                        {p.photos.map((ph) => (
                          <li key={ph.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-t border-rule pt-4 tablet:grid-cols-[9rem_minmax(0,1fr)]">
                            <PrivateImage src={ph.url} alt={`Your healing photo, day ${ph.day}`} ratio="1 / 1" />
                            <div className="min-w-0">
                              <p className="type-meta text-ink-soft">
                                Day {Math.max(0, ph.day)} · {ago(ph.at)}
                              </p>
                              {ph.note && <p className="mt-1 text-body">“{ph.note}”</p>}
                              {ph.response ? (
                                <div className="mt-3 border-l-2 border-burgundy bg-paper-light px-4 py-3">
                                  <p className="type-meta text-burgundy">Younes</p>
                                  <p className="mt-1 text-body leading-copy whitespace-pre-line">{ph.response}</p>
                                </div>
                              ) : (
                                <p className="mt-3 type-meta text-ink-soft">Waiting for Younes</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </article>
            ))}
          </>
        )}
      </LoadState>
    </div>
  );
}
