# Roadmap

Phases run in order. Don't jump ahead: each one is designed against the hero benchmark ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)) before it is built.

| # | Phase | Scope | Depends on |
|---|---|---|---|
| 1 | **Foundation** ✅ | Tailwind + tokens, folder layers, UI primitives, router, domain types, data boundary, state patterns, docs | |
| 2 | **Work / Gallery** | Evolve the archive wall. Filtering only on real metadata. Move `Work.css` layout to Tailwind where practical. | Real work metadata from Younes (style, placement, tags) |
| 3 | **Tattoo detail** | `/work/:slug`: large image, real metadata, related work, Find Similar CTA | 2 |
| 4 | **Find Similar → consultation entry** | Find Similar opens the consultation with the piece; the first question is about it | 3 |
| 5 | **Consultation experience** | Conversational UI (text first), summary filling in, Younes-work search, external inspiration, uploads | 4, an API, `TattooWork.tags` |
| 6 | **Consultation summary** | Review and correct the summary before submitting | 5 |
| 7 | **Client submission / status** | Submit with contact details; a simple status for the client | 6, API + storage |
| 8 | **Studio / about** | Real biography, studio and photography | Real content from Younes |
| 9 | **Booking foundation** | Show confirmed appointments and studio details (no payments) | 7 |
| 10 | **AI / voice** | Orchestrator, voice, concept generation as the last resort ([FUTURE_AI.md](FUTURE_AI.md)) | 5–7 |
| 11 | **Artist dashboard** | Private OS: Today, consultations, clients, appointments, aftercare | 7, auth |
| 12 | **AI secretary + channels** | Read / prepare / execute, unified inbox, AI Activity | 11, channel APIs |

## Phase 1: what was done

- **Tailwind CSS 4** (Vite plugin) as the primary styling system. One token file (`src/styles/theme.css`) with the default palette, fonts, scale, breakpoints, radii and shadows switched off.
- **Token rename** across the hero, ink, work and nav CSS: one name per value, with no raw colours left in components. The hero and the work viewer render pixel-identically to before.
- Book, Studio, the consultation panel, the registration marks and the cursor moved to **Tailwind**, and their CSS files were removed.
- **UI primitives:** Button, Dialog (native), Reveal, ResponsiveImage, StateMessage.
- **React Router** with a layout route, a 404 and a route error boundary. The home page is composed from sections.
- **Domain types** for work, media, consultation (entry, references, summary, status) and client / booking / aftercare.
- **Data boundary:** `hooks/useWork` returns `AsyncState<TattooWork[]>`, and components no longer import data.
- **Consultation context:** one dialog, opened from anywhere with where the client came from (Find Similar seam: `{ from: 'find-similar', workId }`).
- `.env.example`, typed `VITE_*` env, git-ignored env files.
- Docs: PRODUCT, UX_FLOWS, DESIGN_SYSTEM, ARCHITECTURE, ROUTES, FUTURE_AI, ROADMAP.

## Open decisions

- **`ink-muted` contrast** (3.2:1 on paper) is below WCAG AA for small text. Darkening it changes the hero's metadata (see the design system's accessibility section).
- **Work metadata.** Phases 2–5 need real styles, placements and tags from Younes. Nothing is invented in the meantime.
- **Studio content.** The section is a placeholder until a real biography and photography exist.
- **Backend / API.** Its shape and hosting need choosing before Phase 5.
- **Test stack.** Vitest + Testing Library + Playwright, introduced with the first behaviour that needs it (see ARCHITECTURE.md's testing section).
