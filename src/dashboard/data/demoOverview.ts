import type { ConsultationEntry, ConsultationStatus, ConsultationSummary } from '../../domain/consultation';
import type { Appointment, InquiryRecord, Overview } from '../types';

/**
 * DEMO DATA - the dashboard's only data until it has a backend.
 *
 * Every person is a labelled sample ("Sample client K"), never a real
 * client; every figure is invented to show the design. The set is
 * deterministic - the same records on every load, by fixed counts and rules
 * plus a seeded generator - and dated relative to `now`, so it always reads
 * as current. Every KPI, chart and list on the Overview is counted from
 * these records (dashboard/analytics.ts), so they always agree.
 *
 * Replace by having `useOverview` fetch instead.
 */

/** inquiries received per week, oldest first: the last 12 weeks (43 in all) */
const WEEKLY = [3, 4, 3, 2, 4, 3, 5, 3, 4, 3, 5, 4];

/**
 * The ideas, as clients would answer the consultation form - only its own
 * questions (concept, meaning, body area, placement, scale, size, timing,
 * notes); unanswered questions stay unanswered, as they can on the site.
 */
const ANSWERS: Omit<ConsultationSummary, 'references'>[] = [
  { concept: 'A lion with a crown, black and grey', meaning: 'For my father - he always called me his little lion.', bodyArea: 'forearm', placement: 'Outer forearm, wrist to elbow', scale: 'large', size: 'Most of the forearm', timing: 'months' },
  { concept: 'A portrait study in fine shading', bodyArea: 'upper-arm', placement: 'Outer upper arm', scale: 'medium', size: 'About the length of my hand', timing: 'no-rush', notes: 'I have a photograph I would like to work from.' },
  { concept: 'A wolf and a clock, realism', meaning: 'Time and loyalty.', bodyArea: 'leg', placement: 'Outer thigh', scale: 'large-scale', timing: 'months' },
  { concept: 'A botanical piece around an older tattoo', bodyArea: 'shoulder', scale: 'not-sure', timing: 'not-sure', notes: 'There is a small faded tattoo there I would like to work around or cover.' },
  { concept: 'A sleeve continuation', meaning: 'Finishing what we started last year.', bodyArea: 'upper-arm', placement: 'Upper arm to the shoulder cap', scale: 'large-scale', size: 'Half sleeve', timing: 'soon' },
  { concept: 'The convention forearm piece', bodyArea: 'forearm', placement: 'Inner forearm', scale: 'large', timing: 'soon' },
  { concept: 'A religious figure in black and grey', meaning: 'Faith, and my grandmother.', bodyArea: 'back', placement: 'Centre of the upper back', scale: 'large-scale', size: 'Shoulder blade to shoulder blade', timing: 'months', notes: 'Happy to come in for several sessions.' },
  { concept: 'A portrait of my dog', bodyArea: 'forearm', scale: 'medium', size: 'Palm-sized or a little bigger', timing: 'no-rush' },
  { concept: 'A memorial piece with a name', meaning: 'For my brother.', bodyArea: 'chest', placement: 'Over the heart', scale: 'medium', timing: 'soon', notes: 'The handwriting is from a card he wrote.' },
  { concept: 'A small rose study', bodyArea: 'hand', placement: 'Back of the hand', scale: 'small', size: 'About the size of my palm', timing: 'not-sure' },
];

/**
 * Where each idea started on the website, matched to it: the lion and the
 * wolf from Find Similar on the real portfolio pieces they resemble (04 and
 * 07, with what the client was drawn to and the pieces they kept), the
 * convention piece from the demo canvas call, the rest from general ways in.
 */
const ENTRIES: ConsultationEntry[] = [
  { from: 'find-similar', workId: '04', selection: { drawnTo: ['subject', 'linework'], note: 'The detail in the mane.', references: ['08'] } },
  { from: 'work' },
  { from: 'find-similar', workId: '07', selection: { drawnTo: ['mood', 'composition'], references: ['05', '02'] } },
  { from: 'book' },
  { from: 'hero' },
  { from: 'canvas-call', callSlug: 'convention-forearm-black-and-grey', title: 'Convention canvas: a black-and-grey forearm', demo: true },
  { from: 'journal' },
  { from: 'book' },
  { from: 'footer' },
  { from: 'process' },
];

/**
 * Where an inquiry stands, by how long ago it arrived - a fixed rotation in
 * each age band, so the pipeline looks like a studio's: the newest are new,
 * the middle ones in conversation, the oldest booked, done or declined.
 */
function statusFor(daysAgo: number, k: number): ConsultationStatus {
  if (daysAgo <= 2) return 'submitted';
  if (daysAgo <= 6) return (['submitted', 'under-review', 'changes-requested', 'contacted'] as const)[k % 4];
  if (daysAgo <= 20) return (['under-review', 'contacted', 'accepted', 'booking', 'declined'] as const)[k % 5];
  return (['completed', 'booking', 'declined', 'completed', 'accepted'] as const)[k % 5];
}

/** "A" ... "Z", "AA" ... - a sample's letter */
const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));

/** a small seeded generator (mulberry32): the same "random" days every load */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoOverview(now: Date): Overview {
  const rand = seeded(2026);
  const ago = (days: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hour, minute, 0, 0);
    // nothing arrives in the future: earlier today if the hour hasn't come yet
    return (d > now ? new Date(now.getTime() - (days + 1) * 37 * 60_000) : d).toISOString();
  };
  const on = (days: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  // the inquiries, oldest week first; numbered newest first, as a list reads
  const raw: { daysAgo: number; hour: number }[] = [];
  WEEKLY.forEach((count, w) => {
    const weeksAgo = WEEKLY.length - 1 - w;
    for (let n = 0; n < count; n++) raw.push({ daysAgo: weeksAgo * 7 + Math.floor(rand() * 7), hour: 9 + Math.floor(rand() * 12) });
  });
  raw.sort((a, b) => a.daysAgo - b.daysAgo || b.hour - a.hour);
  const inquiries: InquiryRecord[] = raw.map((r, i) => ({
    id: `demo-inq-${i + 1}`,
    clientName: `Sample client ${letter(i)}`,
    status: statusFor(r.daysAgo, i),
    receivedAt: ago(r.daysAgo, r.hour, (i * 17) % 60),
    entry: ENTRIES[i % ANSWERS.length],
    // uploads aren't collected by the form yet: references come only from Find Similar (the entry)
    summary: { ...ANSWERS[i % ANSWERS.length], references: [] },
  }));

  // the people in the calendar and the follow-ups are the inquiries' own
  const who = (status: ConsultationStatus, nth = 0) => inquiries.filter((q) => q.status === status)[nth]?.clientName ?? 'Sample client';

  const appointments: Appointment[] = [
    { id: 'demo-apt-1', clientName: who('booking', 0), kind: 'session', title: 'Session 2 of 3 · upper arm, black and grey', startsAt: on(0, 11), endsAt: on(0, 15), status: 'confirmed' },
    { id: 'demo-apt-2', clientName: who('contacted', 0), kind: 'consultation', title: 'First conversation about a back piece', startsAt: on(0, 16, 30), endsAt: on(0, 17, 15), status: 'confirmed' },
    { id: 'demo-apt-3', clientName: who('completed', 0), kind: 'aftercare', title: 'Two-week aftercare check-in', startsAt: on(0, 18), endsAt: on(0, 18, 15), status: 'confirmed' },
    // tomorrow is free
    { id: 'demo-apt-4', clientName: who('booking', 1), kind: 'session', title: 'Session 1 · leg, realism', startsAt: on(2, 10), endsAt: on(2, 16), status: 'confirmed', prep: 'Stencil to finish' },
    { id: 'demo-apt-5', clientName: who('accepted', 0), kind: 'consultation', title: 'Sizing and placement for a sleeve', startsAt: on(3, 14), endsAt: on(3, 14, 45), status: 'proposed' },
    { id: 'demo-apt-6', clientName: who('booking', 0), kind: 'session', title: 'Session 3 of 3 · upper arm, black and grey', startsAt: on(5, 11), endsAt: on(5, 15), status: 'confirmed' },
    { id: 'demo-apt-7', clientName: who('completed', 1), kind: 'aftercare', title: 'Healed photo for the archive', startsAt: on(5, 17), endsAt: on(5, 17, 20), status: 'confirmed' },
    { id: 'demo-apt-8', clientName: who('booking', 2), kind: 'session', title: 'Session 1 · back piece outline', startsAt: on(6, 12), endsAt: on(6, 18), status: 'proposed', prep: 'Reference sketch to approve' },
  ];

  return {
    demo: true,
    inquiries,
    appointments,
    followUps: [
      { id: 'demo-fu-1', clientName: who('under-review', 0), kind: 'reply', reason: 'Asked whether colour is possible', dueAt: on(-2, 17) },
      // an answer Younes owes: someone in review (Needs details waits on the client, not on him)
      { id: 'demo-fu-2', clientName: who('under-review', 1), kind: 'reply', reason: 'Waiting on your answer about covering an older piece', dueAt: on(0, 12) },
      { id: 'demo-fu-3', clientName: who('booking', 1), kind: 'reminder', reason: 'Send the reference sketch before the session', dueAt: on(1, 10) },
    ],
    activity: [
      ...inquiries.slice(0, 2).map((q, i) => ({ id: `demo-act-in-${i}`, at: q.receivedAt, actor: 'website' as const, text: `New inquiry from ${q.clientName}` })),
      { id: 'demo-act-1', at: new Date(now.getTime() - 3 * 3_600_000).toISOString(), actor: 'assistant', text: `Drafted a reply to ${who('under-review', 1)} — waiting for your approval, not sent` },
      { id: 'demo-act-2', at: new Date(now.getTime() - 20 * 3_600_000).toISOString(), actor: 'you', text: `Confirmed Session 2 with ${who('booking', 0)}` },
      { id: 'demo-act-3', at: new Date(now.getTime() - 28 * 3_600_000).toISOString(), actor: 'you', text: `Moved ${who('under-review', 0)} to In review` },
    ],
  };
}
