# YOUNES / TATTOO: Product

A premium editorial tattoo experience for Younes, a tattoo artist in Detroit, Michigan.

It is not a generic tattoo portfolio, and it is not an AI tattoo generator. It is a personal, editorial way to discover Younes's work and begin a tattoo with him, with AI helping in the background.

## Two experiences

| | Who | Status |
|---|---|---|
| **A. Client-facing website** | People discovering Younes and starting a tattoo | Being built now |
| **B. Private artist operating system** | Younes (and later his studio) | Future. See [FUTURE_AI.md](FUTURE_AI.md) |

Both share one domain: work, consultations, clients, bookings and aftercare. A consultation submitted on the website becomes the first entry in that client's record on the artist side.

## The client journey

```
DISCOVER             the hero: Younes, his name, his portrait
  ↓
EXPLORE THE WORK     the gallery, browsed freely, with no obligation
  ↓
FIND A PIECE         a tattoo that speaks to them → its detail view
  ↓
FIND SIMILAR         the bridge from discovery into consultation
  ↓
CONSULTATION         a conversation, not a form: idea, meaning, style, placement, size
  ↓
REFERENCES           Younes's work first → external inspiration → generated concept (last resort)
  ↓
SUMMARY              the client reviews what was understood
  ↓
SUBMIT TO YOUNES     Younes reviews; he is the decision maker
  ↓
YOUNES RESPONDS      he contacts the client and continues the discussion
  ↓
BOOKING → TATTOO → AFTERCARE → FUTURE RELATIONSHIP
```

There is deliberately **no payment or deposit flow** on the public site. Payments and deposits stay on the artist side.

Flow detail: [UX_FLOWS.md](UX_FLOWS.md).

## Gallery and consultation are separate

| | Gallery | Consultation |
|---|---|---|
| The client is thinking | "Let me discover Younes's work." | "Help me figure out what I want." |
| Commitment | None. Many visitors will only browse. | The start of a conversation with Younes |
| Entry | The site itself | Ask Younes, or **Find Similar** from a piece |

**Find Similar** is the one designed bridge between them. It takes a client from a piece they love into a consultation that already knows that piece.

## The artist side (future)

An AI-powered operating system for Younes. It covers today's work, a unified inbox across channels, potential clients ("client muhtamal"), consultations, clients, appointments, aftercare, and a transparent log of everything the AI did.

The AI acts as a digital secretary that can **read**, **prepare** and, with confirmation, **execute**. See [FUTURE_AI.md](FUTURE_AI.md).

## Non-negotiable principles

1. **Younes's art comes first.** His real work is the centre of every screen it appears on.
2. **AI assists; it does not replace the artist.**
3. **Real Younes work comes before AI-generated content.**
4. **External inspiration comes before generation.**
5. **AI-generated images are concepts, not final tattoo designs.** They are always labelled CONCEPT / REFERENCE.
6. **Clients should never feel they are filling out a corporate form.**
7. **The experience is personal and editorial.**
8. **Younes remains the final artistic decision maker.** The site never promises acceptance, a booking or a date.
9. **External AI actions are transparent.** Nothing is sent on Younes's behalf without his confirmation, and everything the AI does is logged.
10. **The system grows without rebuilding the frontend.** Static data today and an API tomorrow sit behind the same boundaries.

## What the product is not

- Not a generic tattoo portfolio or template site.
- Not an AI tattoo generator, and not a "design your tattoo" toy.
- Not a CRM or SaaS dashboard in look or tone, on either side.
- Not a booking widget, payment page or deposit checkout.
- Not a chatbot bolted onto a website. The consultation is a designed conversation that ends with Younes.

## How it should feel

**Editorial, artistic, premium, minimal, physical, personal.** Like printed matter: paper, ink, type and registration marks. Never glossy, never "app".

The hero is the visual benchmark. Everything built after it must belong to the same world. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Content rules

- Never fabricate tattoo artwork, metadata, biography, credentials, testimonials or client details. Where real information doesn't exist yet, the UI shows less rather than inventing more.
- Only use third-party assets with verified commercial licences, recorded in [INK_ASSETS.md](INK_ASSETS.md) or an equivalent record.
