import type { CanvasCallsContent } from '../domain/canvasCall';

/**
 * Canvas Calls: specific tattoos Younes wants to do.
 *
 * DEMO CONTENT — FICTIONAL EXAMPLES. No real calls exist yet, so these five
 * are invented, by request, to evaluate the pages: one per status, one tied
 * to a (fictional) convention post, one with an offer. The offers,
 * deadlines, conditions and availability are all made up — there is no
 * real discount and no appointment open. Every call is marked `demo: true`
 * and labelled as fictional wherever it appears; artwork is either a
 * placeholder plate or one of Younes's portfolio pieces shown as a
 * reference for the style.
 *
 * Switch off: `status: 'awaiting'`. Publish real calls: `status:
 * 'published'` with calls that carry no `demo` mark and only confirmed
 * offers, conditions and dates — see docs/ROADMAP.md.
 */
export const CANVAS_CALLS: CanvasCallsContent = {
  status: 'demo',
  calls: [
    {
      demo: true,
      slug: 'convention-forearm-black-and-grey',
      title: 'Convention canvas: a black-and-grey forearm',
      summary: 'One forearm piece, tattooed live across the convention weekend.',
      description: [
        'A fictional call, tied to the fictional Northline convention post. The idea: a single black-and-grey forearm piece, drawn for the weekend and tattooed over the three days in front of visitors.',
        'The subject would be settled together in a consultation beforehand, starting from the direction of the reference shown.',
      ],
      status: 'open',
      artwork: { kind: 'reference', workId: '04' },
      placement: 'Forearm, inner or outer',
      scale: 'About 15–20 cm tall',
      offer: 'Demo offer: a reduced rate for the convention piece (no real discount)',
      eligibility: ['18 or over (demo condition)', 'Free for all three convention days (demo condition)'],
      deadline: '2027-02-15',
      eventSlug: 'northline-convention-2027',
      workIds: ['04', '08'],
    },
    {
      demo: true,
      slug: 'upper-arm-study',
      title: 'An upper-arm study, open to your subject',
      summary: 'A realism study for the upper arm, with the subject chosen together.',
      description: [
        'A fictional call without an offer or a deadline, to show the simplest kind: a placement and a scale Younes would like to work at, with the subject still open.',
        'Bring an idea or a few references; the design would grow out of the conversation.',
      ],
      status: 'open',
      artwork: { kind: 'placeholder' },
      placement: 'Upper arm',
      scale: 'Medium — roughly a palm’s width',
    },
    {
      demo: true,
      slug: 'mythological-back-piece',
      title: 'A mythological back piece',
      summary: 'A large, multi-session back piece — details to be announced.',
      description: [
        'A fictional call that has not opened yet: it shows how a call can be announced ahead of time, without taking responses until it opens.',
      ],
      status: 'upcoming',
      artwork: { kind: 'reference', workId: '07' },
      placement: 'Back',
      scale: 'Full back, several sessions',
    },
    {
      demo: true,
      slug: 'wolf-forearm',
      title: 'A wolf for the forearm',
      summary: 'Filled — shown to illustrate a call that is fully booked.',
      description: ['A fictional call that has been filled. It stays visible for a while, so its related work and event remain easy to find.'],
      status: 'booked',
      artwork: { kind: 'reference', workId: '08' },
      placement: 'Forearm',
      scale: 'About 20 cm',
    },
    {
      demo: true,
      slug: 'colour-portrait-calf',
      title: 'A colour portrait for the calf',
      summary: 'Closed — shown to illustrate a call that has ended.',
      description: ['A fictional call that has closed. Closed calls take no responses; the way in is a general consultation.'],
      status: 'closed',
      artwork: { kind: 'placeholder' },
      placement: 'Calf',
      deadline: '2026-08-31',
    },
  ],
};
