# UX flows

The client and artist flows. Principles and vocabulary are in [PRODUCT.md](PRODUCT.md), and routes in [ROUTES.md](ROUTES.md). "Status" says what exists today.

## Client flows

### 1. First visit

The visitor lands on the hero:
- YOUNES set around the artist's portrait.
- A cursor loupe that develops the portrait.
- Faint ink on the paper.
- "The work is already in *you.*"
- The Ask Younes dial.

Scrolling collapses the name into the masthead and hands over to the Work section on the same paper. No pop-ups, cookie walls or chat bubbles compete with it.

**Status:** built.

### 2. Browse the work

The archive wall: Younes's tattoos as pinned prints, each at its native ratio with a contact-sheet caption (number, label, ratio). Everything works without hover. On fine pointers, hover adds clarity and a "View" cue.

The archive's "View all works" opens **the portfolio, `/work`**:
- **Search:** a framed field on the lifted paper, with a magnifier, a visible label ("Search the portfolio"), the placeholder "Search tattoos, styles, placements…" and a clear button while there is a query. It finds by number, title, tags and described traits.
- **Filters:** a toolbar of four compact menus (Style, Subject, Placement, Colour), each a button that shows how many of its values are chosen and opens a small panel of checkboxes with counts. Only one is open at a time; Escape or a click outside closes it. Values in one menu widen the choice; menus together narrow it; search and filters combine. Chosen values also show as removable chips, with "Clear filters" (keeps the search). Below 700px the menus fold behind "Filters (n)". The result count ("8 pieces", or "2 of 8 pieces · showing 1–3, page 1 of 3") sits under the toolbar and is announced.
- While the metadata is demo data, the search label says "sample metadata", a framed notice explains it, and each card's traits read "Sample: …".
- **The introduction:** "/ Portfolio · the archive" and the large "The work" on the left; on the right, what the archive is ("Every piece in the archive, photographed as it left the studio — more are added as they are photographed."), the real piece count ("Pieces 08") and "Photographed as delivered", and the sample-metadata note in burgundy. Then the search and filters, the result count, and the rail the ropes hang from - so the ropes never cross the controls.
- **The gallery - a hanging archive:** a rail across the page with ropes dropping from it, tied at the top: three from 1000px, two from 560px, one on phones (never so many that a tattoo becomes too small). The rope is the home archive's own rope photograph, turned upright and tiled. Prints hang on the ropes in reading order across them (1 on the first rope, 2 on the second…), so every rope is used. Only ropes with a print hang: when the shown prints (after search, filters and the page) are fewer than the ropes that fit - a search leaving two, a last page of one - only that many ropes hang, at the width they have when all three hang, centred under the full rail, so the prints don't grow or jump. With no results there is only the empty state, no rail or ropes. Each print hangs straight from its rope without any hardware, on the home archive's paper print, the photograph whole at its own proportions. A composed table, not chance, gives each print its width (70–88% of its lane), a small sideways shift, a resting angle of about ±1° and its drop from the print above, different from rope to rope and row to row; on one rope the prints swing from side to side of the cord. Below the photograph, inside the same paper mount, its caption: number and title, verified facts or the sample traits, then "View piece →" under a hairline - photograph and caption read as one archival object. Each rope ends shortly after its last print. The whole print is one button. Until a photograph has loaded its area shows a tinted paper and the photo fades in; one that cannot load says "Photograph unavailable".
- **Motion:** once, as a page of prints arrives - the rail draws, the ropes drop, and the prints settle in a short stagger (under a second; clickable from the first frame). Afterwards nothing moves until a pointer or keyboard reaches a print: it straightens on its rope and lifts a hair, and the cue underlines. None of it under reduced motion.
- **Pages:** nine pieces per page. Numbered pages with Previous / Next appear only when there is more than one page (with gaps when there are many); turning one brings the results' top into view and moves focus to the count. Search and filters go back to page 1.
- A piece opens **Work Detail V1** over the grid (`?piece=04`), keeping the page, search and filters; closing (Close, Escape, outside click, Back) returns to the same page with focus on that piece. Find Similar and its handoff to the consultation work from here exactly as from the archive.

**Status:** built. Real metadata replaces the sample values without changing the page.

**After the work, the artist.**
- **What it shows:** the Artist section turns from the prints to the person who made them. It has his portrait, set like a print, and the line *Every print on that line is his work.*, signed *— Younes*.
- **What it states:** only known facts (tattoo artist, Detroit, Michigan, by appointment).
- **Still to come from Younes:** his introduction in his own words. It slots in without changing the layout.
- **The reveal:** the headline settles word by word from faint (50% ink, still 3.3:1) to full ink as it rises through the reading area - complete by the time its bottom reaches 65% of the screen. Progress follows scroll position, so a fast scroll or a reload lands on the right state. His introduction will reveal the same way (from 65%, so body text stays 4.5:1). Under reduced motion all of it is simply full ink. (`ui/ScrollRevealText`, `hooks/useRevealProgress`; no dependency.)

**Then, clients' own words.**
- **Content:** the Client Experiences section ("More than the finished piece.") sets its introduction ("Stories about the ideas, conversations, and decisions behind a tattoo.") beside a carousel of testimonials, one at a time. Each is complete where it stands; nothing opens another screen.
  - **One testimonial,** inside a ruled frame with registration crosses at its corners:
    - who is speaking: a small portrait, the name, and a context label when the data has one ("First tattoo · Fictional example"), with its number at the right;
    - what they said, in full: the largest type in the section, under a burgundy quote mark;
    - optionally, a tattoo beside the words: a small framed plate (4:5 crop) with its caption, to the right on tablet and desktop, a thumbnail under the quote on a phone. A real testimonial's own piece (`workId`, with consent) is captioned "The piece · 03"; a demo entry's is a portfolio sample captioned "Portfolio image — demo";
    - below a rule, its voice note when there is a recording, or plainly "Written testimonial" when there isn't (never a disabled or pretend player).
  - **Navigation:** under the frame, the position ("01 / 03" with a short bar per story, the current one burgundy and longer; announced to screen readers when the visitor turns it) and round previous / next buttons, which wrap around. The row is a native scroll-snap strip, so touch users swipe it. Only the story showing is interactive (the others are inert).
  - **It turns by itself, calmly:** each story stays 7–11s (longer words, longer stay; today about 8s each), then glides to the next, 03 wrapping to 01. A turn commits to its destination at once, so the position never flickers through the stories it passes.
    - **It holds** while a mouse rests on the carousel, while keyboard focus is inside it, while a recording in it plays, while the tab is hidden and while the carousel is off screen. Leaving with the mouse lets it turn about 2.5s later.
    - **The visitor's own touch, click or swipe** inside it (arrows, player, swipe) leaves it alone for 15s; a recording ending does the same.
    - A small "Pause" / "Play" control beside the arrows stops and restarts it. While it turns by itself, its position isn't announced (no chatter every few seconds).
    - It never starts audio, and never turns under reduced motion (and then shows no Pause control).
  - **Voice note:** played only on request. A round play/pause button, the recording's waveform (drawn from peaks measured from the file) filling with burgundy as it actually plays, and the elapsed and total time (measured from the file, so shown before it loads).
    - The waveform is a native range for seeking, by pointer or arrow keys. It takes sideways drags for itself, so a swipe on it doesn't turn the carousel.
    - One recording plays at a time: starting another pauses the first. Moving to another story pauses it, and leaving the page stops it.
    - If the file can't be played it says so and disables the controls.
  - **Layout:** on desktop, the introduction holds the left four columns and the carousel the right eight. On tablet the introduction sits above in two columns (heading | words and notice). On a phone everything stacks: the portrait shrinks to keep room for the quote, and the play and navigation buttons stay 44–48px.
  - **Reduced motion:** no turning by itself; previous / next jump instead of gliding; the bars don't animate.
- **Data:** testimonials live in `data/clientExperiences.ts`, and each records the client's consent to publish (`ClientTestimonial.consent`). Optional: a portrait (covered by that consent) and a recording (`voice`), which records its own consent to be played, separate from the written words'. A recording's `duration` and `peaks` are measured from the file.
- **Three states:**
  - `published`: approved testimonials, each with its consent.
  - `demo`: fictional entries, labelled as such.
  - `awaiting`: renders nothing.
- **Status today: `demo`.** No real client words are approved, so the section shows three fictional testimonials (Alex Morgan, Jordan Lee, Sam Taylor) to evaluate the design on the real page:
  - each record is marked `demo: true`;
  - their portraits are drawn placeholders (a hairline outline and initials), never photographs;
  - Alex's and Jordan's voice notes are synthetic: Windows' built-in speech voices reading the fictional quotes (`assets/testimonials/`). Sam's is written only.
  - Jordan's alone shows a tattoo: piece 04 from the portfolio (`sampleWorkId`), captioned "Portfolio image — demo" and described to screen readers as a sample, not this person's tattoo. The others stay words-and-voice only, for comparison.
- **The demo is labelled as fictional,** visibly:
  - "Demo content — fictional testimonials" under the heading, also linked to the section for screen readers;
  - "Fictional example" beside every name;
  - "Synthetic demo voice — not a real recording" beside every demo player.
- **Demo entries carry no consent and are never presented as the person behind a real piece of Younes's work** (a sample portfolio image says what it is); their portrait can only be a placeholder and their voice only synthetic.
- **Before launch:** replace them with approved testimonials (`published`), or set the status back to `awaiting`, and delete the synthetic recordings.

**Then, how it goes.**
- **Content:** The Process ("From the first idea to the final piece."), between Client Experiences and Book. The intro calls it an outline: "What starting a tattoo with Younes usually involves. Every piece is different, so this is an outline rather than a fixed procedure."
- **Four stages:** 01 Start with an idea, 02 Explore the direction, 03 Discuss the details, 04 Plan the session, each with two sentences (`data/process.ts`).
  - Its own chapter on the heavier `paper-deep` stock. On desktop the four read left to right, each large burgundy number running on into a line toward the next (the last ends in a small mark); the title in serif, the words in mono beneath.
  - Below 1100px they read down the page, one per ruled row: number, title and words side by side on tablet; number beside title and words on a phone.
- **It ends** with "It begins with a conversation." and a "Start a consultation" line button that opens the existing consultation (`{ from: 'process' }`).
- **Indicative, to confirm with Younes.** Drawn only from what the site already establishes (the consultation's questions; Younes proposes a date after talking it through). It promises no fees, deposits, availability, turnaround, revision rounds, delivery dates or results.
- Reveals once on scroll like the other sections; with reduced motion it is simply there.

**Then, what's new.** The Journal preview, a magazine spread on the bright `paper-light` stock: "News from the studio.", a line on what the Journal covers, the demo notice and "Read the journal"; then a lead story with its picture beside a column of two more (what's coming first). Every story has the same parts: category (Convention, Guest spot, Result, Studio news, Announcement) and date or "Coming up · dates", headline, summary, "Read the story →". The whole story is one link. Hidden when nothing is published.

**Then, what's open.** The Canvas Calls preview, set apart from the Journal on the warm `paper-toned` stock under a burgundy rule: "Canvas calls · 02 open", "Looking for a canvas.", what a call is, the demo notice and "All canvas calls"; then a ledger of up to three calls open today, one row each: status and "Respond by …" (or "No deadline") first, the title, summary and particulars, and "Read the call and respond →". The whole row is one link. Hidden when no call is open.

**Then the way in** (Book), its own closing chapter on `paper-light`: two of Younes's real pieces mounted as overlapping prints (02, a tattoo being made, in front of 01), captioned "From the portfolio · 02 & 01", beside "Ready to make it yours?" and a primary "Start a consultation". A single burgundy stroke under "yours?" draws itself once, slowly, as the section arrives (the prints settle into their angles at the same time); under reduced motion both are simply there. No logo or address here. Then the footer on every page, rendered once by `SiteLayout` on `paper-deep`: the official logo with the only confirmed facts (Detroit, Michigan · by appointment), "The site" (Work, Journal, Canvas calls), "Begin" (Start a consultation) and "Follow": each account in `data/social.ts` as its network's official mark (from `simple-icons`, monochrome), an accessible link that opens in a new tab. No verified accounts exist yet, so production shows no Follow area; development shows a preview of the marks (not links) and where to add them.

### 2b. The Journal (`/journal`)

- **Index, set as a magazine:** the title and introduction with the demo notice, closed by the category filter (All, Conventions, Guest spots, Results & awards, Studio, Announcements - only those with posts - each with its count; the current one in burgundy, underlined; `?kind=`, replacing history). Then:
  - **Featured story:** its photograph large beside it (stacked, photograph first, below 700px): "Featured · Upcoming" or "· Recent", category, date and "Fictional example", headline, summary, the event's name, dates and place when it is about one, and a framed "Read story →". Chosen from the data, never by name: the nearest upcoming event with a photograph that exists, else the newest recent story with one, else the first upcoming or recent story - set as type, its date large beside it, with no empty frame. It leaves its own band, so no story appears twice. Archive stories are never featured. Its photograph is fetched at once (eager, high priority), not lazily: it is the first screen's picture.
  - **Upcoming** on a `paper-deep` band, as a calendar, soonest first: the days large in burgundy over the month and year, then category, title, place and a summary of at most three lines, "Read story →" at the right. No pictures - it is for scanning.
  - **Recent** (the last twelve months): a lead story - the newest with a photograph - its picture beside it, with "Also recent" in a ruled column next to it (headline, summary of at most three lines, "Read story →"). Alone in its band, the lead spans it.
  - **Archive**, quieter: one row per story - date, category, headline with its "Fictional example", a small arrow - the whole row one link.
  - A band with nothing in it under the current filter isn't drawn; a filter that leaves nothing says "Nothing in this category yet." with "Show everything". Every story card is clickable across its whole area through its one "Read story" link (named with the title for screen readers) - no nested or duplicate links.
- **A post:** category and date, headline, summary, the event's particulars when it is about one ("Coming up" or "The event"), its picture, the story, then canvas calls for it, pieces mentioned, and older / newer posts.
- **Demo today:** five fictional posts (`data/journal.ts`), each marked "Fictional example"; the page says "None of these events or results are real", and the fictional competition result says "Fictional result — not a real achievement". Pictures are Younes's portfolio pieces captioned "Portfolio image — demo".

### 2c. Canvas Calls (`/canvas-calls`)

- **What they are:** particular pieces Younes wants to tattoo, looking for the person to wear them - different from the Journal, which records what happened.
- **Index:** open and upcoming calls set large - picture (a portfolio reference or a placeholder plate), number, status, title, summary and a ruled spec (placement, scale, offer, respond by). Filled and closed calls follow as a quiet list.
- **A call:** its picture at its own proportions, the description, the spec (with conditions and its event, linked to the Journal post), related work, and the next step:
  - **open:** "Respond to this call" opens the guided consultation with the call attached (`{ from: 'canvas-call', callSlug, title, demo }`). The call shows on the consultation's first step, in its review and on the finished draft. The note under the button says nothing is sent yet.
  - **upcoming / filled / closed:** says so, and offers a general consultation - never a dead apply button.
- **Demo today:** five fictional calls (`data/canvasCalls.ts`), one per status, one tied to the fictional convention post, one with a fictional offer. "Demo content — fictional calls. No offer, deadline or appointment here is real."

### 3. Open a tattoo

A piece opens to its detail view:
- The large image.
- Real metadata only: style, placement and description when Younes provides them.
- Related work.
- **FIND SIMILAR**.

Today this is the Work viewer dialog, with prev/next, arrow keys, Escape and focus return. It becomes the `/work/:slug` page, which is shareable and can be indexed by search engines.

**Status:** viewer built. The detail page is Phase 3.

### 4. Find Similar

From a piece's detail, the client chooses **Find similar →**. A sheet opens over the detail, starting from that piece. It is two steps, image-led, with short copy and no chat bubbles:

1. **What speaks to you about this piece?** The piece is shown large, labelled *Starting from … 03 of 08*. The client can tick any of: subject, composition, linework and detail, style, mood or feeling, placement, something else. They can also write in their own words. Everything is optional. These are the client's preferences, not facts about the piece.
2. **More of Younes's work.** Real pieces from the archive, four at a time.
   - The client can **keep** a piece (shown by a burgundy frame, a tick and "Kept") or set it aside as **not for me** (it leaves the list and can be brought back).
   - **Show me something different** pages through the rest.
   - The starting piece and everything kept are always in view as *Your references*: a column on desktop, a bar along the bottom on smaller screens.
   - **Continue** opens the guided consultation (§5) over the sheet, carrying the starting piece, the kept pieces, the ticked preferences and the note (`ConsultationEntry { from: 'find-similar', workId, selection }`). Closing the consultation comes back to step 2 as it was.

**How the suggestions are ordered:**
- **With answers:** pieces closest to what the client said speaks to them come first. This is basic metadata matching against the starting piece, not AI (see ARCHITECTURE.md, "Tattoo metadata").
- **Without answers:** the archive order.

The metadata behind this order is **demo data for now**. Find Similar says so in one quiet line, and the line goes once Younes verifies the pieces. Pieces set aside never come back unless the client brings them back, and changing the answers re-orders the suggestions without touching what was kept.

**Status:** built (Phase 4).
- Each step has its own address (`?similar=03`, then `&step=pieces`). The browser's Back walks back through the steps to the piece, and Close or Escape returns to it directly.
- What was chosen stays while the page is open: reopening Find Similar on the same piece picks up where the client left off. A different piece starts fresh.
- Nothing is sent anywhere yet. The consultation shows what it received; the conversation itself is Phase 5.

### 5. Consultation

A conversation (voice or text) that helps the client understand and develop their idea. It covers:
- The concept, and its meaning or story.
- Style and visual direction.
- Placement and approximate size.
- Colour or black-and-grey.
- References, and what the client likes and dislikes.
- Any other notes.

It asks one thing at a time, in Younes's voice, and never as a long form. The understanding builds up in a `ConsultationSummary` the client can see.

**Status:** the guided draft is built. It is a frontend-only draft: nothing is stored beyond the page, and nothing is sent.

It is a sheet over the page with four steps, a quiet progress line (*Consultation · 2 of 4 · Placement and scale*) and Back / Continue on every step. Every answer is optional.

1. **The idea.** *Let's talk about your tattoo.*
   - Two open questions: what they'd like tattooed, and the idea, story or feeling behind it.
   - From Find Similar, the step shows what they bring: the starting piece (labelled as such), the pieces they kept, what drew them and their note.
   - From Ask Younes or the booking section there are no references, and nothing stands in for them: *No references needed — a few words are enough to begin.*
2. **Placement and scale.** Rough choices, never specifications (*we'll settle placement and size together*), each with an optional "in your words":
   - Where: forearm, upper arm, shoulder, chest, back, leg, hand or fingers, somewhere else, not sure yet.
   - How big: small, medium, large, large-scale, not sure yet.
3. **Timing and details.** A timeframe (as soon as possible, the next few months, no rush, not sure yet), and anything else to know. The step says plainly there's no booking here. Nothing personal is asked.
4. **Review.** *Here's your idea.*
   - Everything gathered, grouped to read: references, the idea, placement and scale, timing, anything else. Unanswered parts say "Not answered — that's fine".
   - Each part has **Change**, which goes to that step and back to the review.
   - References belong to Find Similar: closing the consultation returns there to change them.

**Finish consultation** ends the flow honestly: *Your consultation draft is ready… Nothing has been sent yet. Sending it to me directly is still to come.* It never says Younes has received anything or will be in touch. The draft is marked `reviewedAt` but stays `status: 'draft'`.

**Drafts:**
- There is one draft for general entries (Ask Younes, the booking section) and one per starting piece in Find Similar, so a general idea and a piece-led one never overwrite each other.
- Closing (Close, Escape, a click outside) or the browser's Back keeps the draft, and reopening resumes the same step. A finished draft reopens as ready.
- The open consultation is one history entry (`?consult`), so Back closes it and leaves Find Similar as it was.
- **Changing references:** Find Similar's references are the source of truth. Continuing from it again refreshes them in the draft and keeps the answers. If the draft was already finished, it goes back to the review to be looked over.
- Drafts last only while the page is open. A reload drops them, and the `?consult` mark with them. Cross-visit persistence is a separate decision.

**Not built yet:** sending to Younes (§9), contact details, uploads, external inspiration, and any AI or voice. The Ask Younes dial still opens the text consultation; its voice is Phase 10.

### 6. Inspiration search

When the client needs references, the order is fixed:

1. **Younes's own work.** Search the archive by what the conversation has understood (tags, style, subject). Show matches, and let the client like, reject or refine them.
2. **External inspiration**, only if Younes's work is not enough. Each result is shown with its source and credit (`TattooReference { kind: 'external' }`).
3. **Client uploads.** The client can add their own images at any point.

**Status:** Phase 5. Needs real tags on the work (`TattooWork.tags`) and a search service.

### 7. Concept generation (last resort)

Only when steps 1–2 failed to capture the idea. A generated image is always labelled **CONCEPT / REFERENCE**, never presented as a final design, and never the visual centre of the page. It goes into the summary as a reference like any other (`kind: 'concept'`, with the prompt kept).

**Status:** Phase 10.

### 8. Consultation summary

Before anything is sent, the client sees what was understood:
- Concept, meaning and style.
- Placement, size and colour.
- References, likes and dislikes.
- Notes.

They can correct any part in place.

**Status:** the review step of the guided consultation (§5) does this for what the draft gathers today: the client sees every answer and changes any part in place. Style, colour, likes and dislikes join it when the consultation asks about them.

### 9. Submit to Younes

The client confirms the summary and leaves a way to reach them (`ClientContact`). The confirmation says plainly what happens next: *Younes reviews every request himself and will contact you.* It never promises acceptance, a date or a price.

**Status:** Phase 7.

### 10. Artist review

Younes reads the consultation and moves it through its states:

```
submitted → under-review → accepted | changes-requested | declined
accepted → contacted → booking → completed
```

The client may later see a simple status (Phase 7). Only Younes moves a consultation past `submitted`.

**Status:** types only (`ConsultationStatus`).

### 11. Booking

Younes (not the website) proposes a date after talking to the client. The public site may show the confirmed appointment and studio details. There are no deposits or payments on the public site.

**Status:** Phase 9 (foundation only).

### 12. Aftercare

After the tattoo:
- Aftercare instructions.
- Planned follow-ups.
- A way to ask questions.

**Status:** future.

### 13. Return

A returning client is recognised as an existing client. Their history (past consultations, tattoos) informs the next consultation, so they never start from zero.

**Status:** future. This is why a consultation is the start of a client record, not a disposable form.

## Artist flows (future: private dashboard)

### Today view

What needs Younes now:
- New potential clients.
- Consultations waiting for review.
- Today's appointments.
- Aftercare check-ins due.

### AI secretary

> *Knock knock.* "What do we have?"
> "One new potential client from the website: a black-and-grey botanical piece on the forearm, medium size, three references."
> "Show me more." … "Prepare a message." … *(reviews the draft)* … "Send it."

The AI **reads** and summarises, **prepares** drafts and actions, and **executes** only on confirmation. See [FUTURE_AI.md](FUTURE_AI.md).

### Reviewing a consultation

Younes opens the summary and references, sets the status, and contacts the client directly or through a prepared message he approves.

### Unified inbox

Website consultations and, later, WhatsApp, Instagram, Facebook and other channels arrive in one place. Each item is classified (potential client, existing client, appointment, aftercare, general/personal) and attached to the right client record.

### AI activity

A plain log of everything the AI did: read, summarised, classified, prepared, sent after approval. Younes can always see what was done in his name.
