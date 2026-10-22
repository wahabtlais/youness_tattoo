# Roadmap

Phases run in order. Don't jump ahead: each one is designed against the hero benchmark ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)) before it is built.

| # | Phase | Scope | Depends on |
|---|---|---|---|
| 1 | **Foundation** ✅ | Tailwind + tokens, folder layers, UI primitives, router, domain types, data boundary, state patterns, docs | |
| 2 | **Work / Gallery** | Evolve the archive wall. Filtering only on real metadata. Move `Work.css` layout to Tailwind where practical. | Real work metadata from Younes (style, placement, tags) |
| 3 | **Tattoo detail** | `/work/:slug`: large image, real metadata, related work, Find Similar CTA | 2 |
| 4 | **Find Similar → consultation entry** ✅ | From a piece: what speaks to you about it, more of the work to keep or set aside, then the consultation with all of it. Suggestions are the rest of the archive until real metadata allows ranking | 3 |
| 5 | **Consultation experience** — guided draft ✅ | Built: a guided text draft (idea, placement and scale, timing and notes) that carries Find Similar's references. Still to come: Younes-work search inside it, external inspiration, uploads | 4, an API, `TattooWork.tags` |
| 6 | **Consultation summary** — review ✅ | Built: review and change every answer before finishing (local only). Submitting it is Phase 7 | 5 |
| 7 | **Client submission / status** | Submit the reviewed draft with contact details; a simple status for the client. Until then the draft's last screen says plainly that nothing is sent | 6, API + storage |
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

## Before publishing

- **Social accounts.** Add the studio's verified accounts to `data/social.ts` (exact handle and the account's own URL); the footer's Follow area appears once there is at least one.
- **Hosting fallback.** Every page is client-routed: the host must serve `index.html` for any path that isn't a file (`/work`, `/journal/…`, `/canvas-calls/…`, `/work/04`). Checked with `vite preview` on the production build. The site must be served from the domain root: asset and photograph paths are absolute (`/work/web/…`, `/youness_tattoo_logo-640.webp`); a sub-path would need Vite's `base` and those paths updated.
- **No environment variables or secrets** are needed today. `import.meta.env.DEV` only shows the Artist section's marked placeholder in development.
- **Demo content** must be switched off or replaced (testimonials, journal, canvas calls, synthetic voices, sample work metadata): see the items below.
- **Not yet checked:** Safari, Firefox, real phones and tablets, and a screen-reader pass.

## Open decisions

- **`ink-muted` contrast** (3.2:1 on paper) is below WCAG AA for small text. Darkening it changes the hero's metadata (see the design system's accessibility section).
- **Work metadata.** Phases 2–5 need real styles, placements and tags from Younes. The model and matching exist. Until Younes verifies it, the metadata is clearly marked demo data, used only to order Find Similar's suggestions and never shown as fact. It must be verified before launch.
- **Client testimonials (must change before launch).** No client words, names, photographs, recordings or ratings have been supplied with permission to publish. For layout evaluation, the Client Experiences section currently shows **three fictional testimonials** (`status: 'demo'` in `data/clientExperiences.ts`), visibly labelled "Demo content — fictional testimonials", with every entry marked "Fictional example". They have drawn placeholder portraits, one shows a portfolio piece captioned "Portfolio image — demo", and two have synthetic voice notes (computer speech reading the fictional quotes, labelled "Synthetic demo voice — not a real recording", in `src/assets/testimonials/`). Before launch, do one of these, and delete the synthetic recordings:
  - Replace them with approved quotations, exactly as clients wrote them, each with its consent recorded, and set `status: 'published'`. The type requires the consent.
  - Set `status: 'awaiting'`, which hides the section.
  - Voice notes are optional: a client's own recording, added to their testimonial (`voice`) with its own consent to be played. Never a synthetic or re-recorded voice.

  Never invent or reword real testimonials.
- **Journal and Canvas Calls content (demo today).** `data/journal.ts` (five fictional posts) and `data/canvasCalls.ts` (five fictional calls) exist to evaluate the pages. Before launch, either set each to `status: 'awaiting'` (the home previews disappear and the pages say nothing is published) or replace them with real records without the `demo` mark: real events, dates and places; only results Younes actually achieved; only offers, conditions, deadlines and availability he confirms. Calls with real artwork need his drawings (`artwork: { kind: 'design', image, alt }`).
- **Portfolio filters.** `/work` filters on the demo metadata today and says so. They become real the moment pieces are `metadataStatus: 'verified'`.
- **Process copy (to confirm with Younes).** The Process section's four steps (`data/process.ts`) are an indicative outline drawn from what the site already establishes, and say so. Younes should confirm or reword them. Nothing about fees, deposits, availability, timelines or revisions is stated, and nothing should be until he supplies it.
- **Artist content.** The Artist section (after Work) is built and states only known facts: his name, Detroit, Michigan, by appointment, and that the archive is his work. Its portrait is the photograph chosen for it (original kept out of Git in `assets-src/artist-section.png`), shown whole. His introduction is an empty slot in `data/artist.ts` (`intro`): production shows nothing there, and development shows a marked placeholder. It needs Younes's own words. The masthead still labels the link to it "Studio" (`#studio`), which may want renaming.
- **Backend / API.** Its shape and hosting need choosing before Phase 5.
- **Test stack.** Vitest + Testing Library + Playwright, introduced with the first behaviour that needs it (see ARCHITECTURE.md's testing section).
