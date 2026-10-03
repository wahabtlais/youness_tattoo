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

Later it gains filtering (style, placement, subject) once real metadata exists. Filters only appear for fields that are actually filled in.

**Status:** wall built. Filtering is Phase 2, and only with real metadata.

### 3. Open a tattoo

A piece opens to its detail view:
- The large image.
- Real metadata only: style, placement and description when Younes provides them.
- Related work.
- **FIND SIMILAR**.

Today this is the Work viewer dialog, with prev/next, arrow keys, Escape and focus return. It becomes the `/work/:slug` page, which is shareable and can be indexed by search engines.

**Status:** viewer built. The detail page is Phase 3.

### 4. Find Similar

From a piece, the client chooses Find Similar. A consultation opens that already knows the reference (`ConsultationEntry { from: 'find-similar', workId }`). The first question is about the piece: *what do you like about it?* The line work, the subject, the shading, the placement, the scale?

**Status:** the entry seam exists. The viewer's "Ask Younes about a piece like this" already opens the consultation with the piece's id. The conversation itself is Phase 4–5.

### 5. Consultation

A conversation (voice or text) that helps the client understand and develop their idea. It covers:
- The concept, and its meaning or story.
- Style and visual direction.
- Placement and approximate size.
- Colour or black-and-grey.
- References, and what the client likes and dislikes.
- Any other notes.

It asks one thing at a time, in Younes's voice, and never as a long form. The understanding builds up in a `ConsultationSummary` the client can see.

**Status:** the shell dialog is built (Ask Younes from the hero, work and booking). The conversation is Phase 5.

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

**Status:** Phase 6. The type `ConsultationSummary` exists.

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
