import type { JournalContent } from '../domain/journal';

/**
 * The Journal's posts.
 *
 * DEMO CONTENT — FICTIONAL EXAMPLES. No real news, events or results have
 * been supplied, so these five are invented, by request, to evaluate the
 * Journal on the real site: an upcoming convention, a guest spot, a
 * competition result, a studio update and an older note. The events,
 * venues and the result are made up; nothing here says Younes attended,
 * won or announced anything. Every post is marked `demo: true` and the
 * site labels each one as fictional. Images are Younes's real portfolio
 * pieces (by work id), captioned as portfolio images.
 *
 * Switch off: set `status: 'awaiting'` (the home preview disappears, the
 * Journal page says nothing has been published yet). Publish real posts:
 * `status: 'published'` with posts that carry no `demo` mark — see
 * docs/ROADMAP.md. Dates are fixed: as time passes, "upcoming" demo events
 * move to "recent" and then "archive" on their own.
 */
export const JOURNAL: JournalContent = {
  status: 'demo',
  posts: [
    {
      demo: true,
      slug: 'northline-convention-2027',
      kind: 'convention',
      title: 'Three days at the Northline Tattoo Convention',
      date: '2026-10-02',
      summary:
        'A booth for the whole weekend, one large piece tattooed live, and a few hours kept open for conversations about new work.',
      body: [
        'Northline is a fictional convention, written here to show how an announcement reads. The idea is a weekend booth: one large black-and-grey piece tattooed over the three days, with time between sessions for anyone who wants to talk through an idea of their own.',
        'The convention piece is open as a Canvas Call — a forearm design for one person, worked on across the weekend. Everything about it, including the dates and the offer, is a demo.',
        'If you plan to visit, start a consultation beforehand so there is time to talk properly rather than across a busy floor.',
      ],
      image: { workId: '04', caption: 'Portfolio image — demo' },
      event: { name: 'Northline Tattoo Convention (fictional)', location: 'Detroit, Michigan', start: '2027-03-12', end: '2027-03-14' },
      workIds: ['04', '08'],
      callSlugs: ['convention-forearm-black-and-grey'],
    },
    {
      demo: true,
      slug: 'guest-week-chicago',
      kind: 'guest-spot',
      title: 'A guest week in Chicago',
      date: '2026-09-18',
      summary: 'Five days as a guest artist, with a short list of appointments for larger work.',
      body: [
        'A fictional guest spot, to show how shorter announcements sit in the Journal: a week away from the home studio, a handful of appointments, and the chance to meet people who have been following the work from further away.',
        'Real dates, the host studio and how to request a slot would be published here once confirmed.',
      ],
      event: { name: 'Guest week (fictional)', location: 'Chicago, Illinois', start: '2026-12-07', end: '2026-12-11' },
    },
    {
      demo: true,
      slug: 'black-and-grey-result',
      kind: 'award',
      title: 'Second place, black and grey — a fictional result',
      date: '2026-06-09',
      summary:
        'How a competition result would be reported. This result is invented for the demo — Younes has not won this award.',
      body: [
        'This post is a fictional example of how a competition result would appear in the Journal. The competition, the category and the placing are invented. Nothing here is a real achievement.',
        'A real result would name the convention, the category and the piece entered, link to the piece in the portfolio, and say a few words about the person who wore it — with their agreement.',
      ],
      image: { workId: '08', caption: 'Portfolio image — demo' },
      event: { name: 'Lakeside Ink Weekend (fictional)', location: 'Grand Rapids, Michigan', start: '2026-06-06', end: '2026-06-07' },
      workIds: ['08'],
    },
    {
      demo: true,
      slug: 'new-pieces-in-the-archive',
      kind: 'studio',
      title: 'New pieces in the archive',
      date: '2026-04-22',
      summary: 'Recent large-scale work, photographed and added to the portfolio.',
      body: [
        'A fictional studio update, written to show how a post can point back to the portfolio: two recent pieces have been photographed and hung in the archive.',
        'Each piece has its own page, and Find Similar can start from either of them.',
      ],
      image: { workId: '07', caption: 'Portfolio image — demo' },
      workIds: ['07', '05'],
    },
    {
      demo: true,
      slug: 'a-winter-of-large-work',
      kind: 'announcement',
      title: 'A winter of large work',
      date: '2025-02-03',
      summary: 'An older note, kept in the archive: a season given over to sleeves and back pieces.',
      body: [
        'A fictional older post, to show how the archive holds stories that are no longer news. It reflects on a season spent on long, multi-session pieces rather than single appointments.',
      ],
      workIds: ['03', '06'],
    },
  ],
};
