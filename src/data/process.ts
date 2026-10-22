/**
 * The Process section: how starting a tattoo with Younes usually goes.
 *
 * INDICATIVE - TO CONFIRM WITH YOUNES. This is an outline drawn from what
 * the site already establishes (the consultation asks for the idea and the
 * story behind it, references, placement and size; Younes proposes a date
 * after talking it through - docs/UX_FLOWS.md), not a stated studio policy.
 * It deliberately promises nothing that hasn't been confirmed: no fees,
 * deposits, availability, turnaround, revision rounds, delivery dates or
 * guarantees. The section says it is an outline.
 */
export interface ProcessStep {
  title: string;
  body: string;
}

export const PROCESS_INTRO =
  'What starting a tattoo with Younes usually involves. Every piece is different, so this is an outline rather than a fixed procedure.';

export const PROCESS_STEPS: ProcessStep[] = [
  {
    title: 'Start with an idea',
    body: 'Share the idea, the story or the feeling behind it, and anything that points the way. You don’t need a finished design to start a conversation.',
  },
  {
    title: 'Explore the direction',
    body: 'References, pieces from the portfolio and what you’re drawn to help find a direction together — one that becomes yours, not a copy of someone else’s tattoo.',
  },
  {
    title: 'Discuss the details',
    body: 'Placement, size and the details the idea needs are talked through with Younes, so the design can take shape around you.',
  },
  {
    title: 'Plan the session',
    body: 'With the direction and the practical details clear, the conversation continues and Younes proposes a time for the session.',
  },
];
