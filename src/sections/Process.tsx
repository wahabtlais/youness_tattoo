import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { PROCESS_INTRO, PROCESS_STEPS } from '../data/process';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The way from an idea to a session, after the clients' words and before
 * the Journal - its own chapter on a heavier paper stock (paper-deep), so
 * it begins and ends where the colour does. Four stages read as one
 * sequence: on desktop left to right, each large number running on into a
 * burgundy line toward the next; below 1100px down the page, the line
 * dropping from number to number. It ends by handing over to the
 * consultation that already exists (`onStart`). Copy and its caveats:
 * data/process.ts.
 */
export function Process({ onStart }: { onStart: () => void }) {
  return (
    <section
      id="process"
      aria-labelledby="processHeading"
      className="mt-[clamp(3rem,8vh,5rem)] bg-paper-deep px-page-x py-[clamp(4rem,11vh,7.5rem)]"
    >
      <Reveal className="mx-auto max-w-page">
        <div className="grid gap-x-[clamp(2rem,6vw,5rem)] gap-y-5 tablet:grid-cols-2 tablet:items-end desktop:grid-cols-12">
          <header className="desktop:col-span-7">
            <p className="type-eyebrow text-burgundy">The process</p>
            <h2 id="processHeading" className="mt-4 max-w-[17ch] type-heading text-headline">
              From the first idea to the final piece.
            </h2>
          </header>
          <p className="max-w-[38ch] text-body leading-copy text-ink-soft desktop:col-span-4 desktop:col-start-9 desktop:pb-2">
            {PROCESS_INTRO}
          </p>
        </div>

        <ol className="mt-[clamp(3rem,8vh,5rem)] grid gap-y-[clamp(2rem,5vw,2.75rem)] desktop:grid-cols-4 desktop:gap-x-[clamp(1.5rem,2.6vw,2.75rem)]">
          {PROCESS_STEPS.map((step, i) => {
            const last = i === PROCESS_STEPS.length - 1;
            return (
              <li key={step.title} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 tablet:grid-cols-[5rem_minmax(0,1fr)] desktop:block">
                {/* the number, and the line it runs on into the next stage */}
                <div className="relative desktop:flex desktop:items-center desktop:gap-4">
                  <p className="font-serif text-[clamp(2.6rem,4.6vw,4.25rem)] leading-[0.9] text-burgundy">
                    <span className="sr-only">Step </span>
                    {two(i + 1)}
                  </p>
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-[clamp(3rem,5.4vw,4.75rem)] -bottom-[clamp(2rem,5vw,2.75rem)] left-[clamp(1.2rem,2.2vw,1.5rem)] w-px bg-burgundy/35 desktop:static desktop:h-px desktop:w-auto desktop:flex-1"
                    />
                  )}
                  {last && <span aria-hidden="true" className="hidden size-1.5 rotate-45 bg-burgundy desktop:block" />}
                </div>
                <div className="desktop:mt-[clamp(1.25rem,2.4vw,1.75rem)] desktop:pr-2">
                  <h3 className="font-serif text-title text-ink">{step.title}</h3>
                  <p className="mt-2.5 max-w-[34ch] text-body leading-copy text-ink-soft">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-[clamp(3rem,8vh,4.5rem)] flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-ink/15 pt-[clamp(1.25rem,3vh,1.75rem)]">
          <p className="font-serif text-lede text-ink-soft italic">It begins with a conversation.</p>
          <Button variant="secondary" onClick={onStart}>Start a consultation</Button>
        </div>
      </Reveal>
    </section>
  );
}
