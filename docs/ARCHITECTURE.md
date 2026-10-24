# Frontend architecture

React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, React Router 8, oxlint. There is no state library or AI SDK in the browser. The backend - a Node.js + Fastify API over PostgreSQL, with its own sign-in - is in `server/`, and the types and validation both sides share are in `packages/contracts`: see [server/README.md](../server/README.md).

Related docs: [ROUTES.md](ROUTES.md) for routing, [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for tokens and visual rules, and [FUTURE_AI.md](FUTURE_AI.md) for the AI architecture.

## Layers

```
pages        compose sections for a route, and wire them to app services
  ↓
sections     one editorial part of a page (Hero, Work, Artist, ClientExperiences, Book)
  ↓
components   domain components (hero/, work/, consultation/, layout/)
  ↓
ui           primitives with no domain knowledge (Button, Dialog, …)
```

Dependencies only point down. `hooks/`, `domain/`, `lib/` and `data/` are shared below all of them, and components never import `data/` directly (see Data boundary).

## Folders

```
src/
├── app/            App (router provider), routes, SiteLayout, RouteError
├── pages/          HomePage, WorkPage, JournalPage, JournalPostPage, CanvasCallsPage, CanvasCallPage, NotFoundPage - thin, one per route
├── sections/       Hero, Work, Artist, ClientExperiences, Process, JournalPreview, CanvasCallsPreview, Book (+ Hero.css, Work.css)
├── components/
│   ├── ui/         Button (+ buttonStyles), ButtonLink, Dialog, Reveal, ScrollRevealText, ResponsiveImage, StateMessage, TextField, DemoNotice, PlaceholderPlate
│   ├── layout/     Nav (+ menu), Footer, BrandLogo (the official logo), SocialIcon (+ socialIcons), PageHeader, NotFound, ScrollManager, siteLinks, RegistrationMarks - the frame on every page
│   ├── content/    ContentParts: the journal's and canvas calls' picture, status tag, related work, back link
│   ├── hero/       the hero's planes: portrait, type, marks, ink, voice dial, cursor
│   ├── work/       physical-archive/ (the home archive and Work Detail V1), portfolio/ (the /work page: RopeGallery + ropeGallery.css - the hanging archive - PortfolioDetail - V1 over it - PortfolioSearch, FilterMenu, Pagination); WorkGallery, WorkItem, WorkMeta, WorkViewer (the earlier wall, unused)
│   ├── consultation/  ConsultationProvider + useConsultation, ConsultationPanel
│   ├── find-similar/  FindSimilar (sheet + steps), its session model and address (useFindSimilarRoute)
│   └── testimonials/  TestimonialCarousel (scroll-snap, one complete testimonial per slide; useAutoAdvance, its considerate turning), TestimonialPortrait (photo or drawn placeholder), VoiceNote (player with measured waveform)
│                      (the matching it uses is domain/workMatching.ts)
├── domain/         TypeScript types for the product (work, consultation, client, media, journal, canvasCall) and pure rules over them (workMatching, workSearch)
├── hooks/          useRopeCount (the /work ropes per width), useWork, useJournal / useCanvasCalls (useContent), usePieces - the data boundary; useDocumentTitle, useInView, useReducedMotion, hero engines
├── data/           static records (work, its demo metadata, the artist section's words, client experiences, the process steps, journal, canvasCalls) - what an API replaces
├── lib/            tiny helpers: cx, AsyncState, date, pagination
├── styles/         theme.css (tokens), base.css (element defaults)
├── assets/         bundled images (hero plates, ink strips, placeholders)
└── index.css       Tailwind + theme + base
public/work/        tattoo photographs (originals) and web/ (generated WebP)
scripts/            offline Python pipelines (ink, portrait, work images)
assets-src/         source material, not served (git-ignored where licensed)
```

Naming:
- Components are `PascalCase.tsx`, one exported component per file.
- Hooks are `useThing.ts`. A context and its hook live in a `.ts` file next to the provider (fast-refresh friendly).
- Domain types are nouns from [PRODUCT.md](PRODUCT.md): `TattooWork`, `Consultation`, `ConsultationSummary`.

## Styling

**Tailwind is the primary styling system.** New components are styled with utilities that read semantic tokens: `bg-paper`, `text-ink-muted`, `type-label`, `px-page-x`, `ease-editorial`, `desktop:`.

**Hand-written CSS is kept only where it is genuinely the better tool:**

| File | Why it stays CSS |
|---|---|
| `sections/Hero.css` | Scroll choreography derived from one progress variable, registered masks, keyframed breathing, a pseudo-element-heavy voice dial. Its geometry variables (`--pcx`, `--ph`, `--ptop`, `--fs`, …) are shared with the ink. Where scroll timelines exist, each scroll-moving layer (the word's three planes and its letters, the portrait, the marks, both ink layers, the copy) also has a scroll-driven `transform` / `opacity` animation generated from the same formulas, so the compositor moves it in step with the scroll it paints - a main-thread `--p` let the page scroll first and the word lurch, then snap back. The `calc(var(--p))` rules remain the fallback (no scroll timelines) and keep reduced motion still. |
| `components/hero/InkField.css`, `InkDrops.css` | Hero-geometry positioning, cursor-reactive custom properties, masks, per-breakpoint art direction |
| `sections/Work.css` | Per-slot salon-wall placement at three breakpoints, the develop-in transition, crop-mark backgrounds, the hero hand-off. To be revisited in Phase 2, when the gallery changes anyway. |
| `components/layout/Nav.css` | The masthead's paper strip and rule, driven by the hero's `--hero-p` / `--hero-q` |

Rules for both:
- **Every value comes from a token** (`styles/theme.css`). Hand-written CSS uses the same tokens through `var(--color-…)`, `var(--font-…)`, `var(--spacing-…)`, `var(--ease-…)`, `var(--duration-…)`. No raw hex codes, font stacks or easing curves in components.
- Don't force complex animation into long class strings. If a component needs keyframes, masks, or pseudo-element choreography, give it a CSS file next to it and say why at the top.
- One-off layout numbers (a specific `clamp()` padding) can be arbitrary values. A value used twice becomes a token.
- Join conditional classes with `lib/cx`. Variants are plain objects (see `ui/Button`); no class-merging library is needed yet.
- `button.unstyled` (`styles/base.css`) is a legacy reset kept for the hero and work controls. New code uses `ui/Button`.

Cascade:
- Tailwind's preflight and `base.css` are in `@layer base`, and utilities in `@layer utilities`.
- Hand-written component CSS is unlayered, so it wins over both. That is why the hero and work render exactly as before the migration.
- `base.css` restores the browser's own `line-height: normal`, which the original design was set on.

## UI primitives

There are eight, built because existing code needed them (the two newest: `DemoNotice`, the framed or inline mark on fictional content, and `PlaceholderPlate`, a ruled plate with crop marks where an image will go):

| | |
|---|---|
| `Button` | `primary` (solid burgundy, paper text: the one main action of a place), `secondary` (ink frame that fills with ink on hover: a lesser action), `navigate` (the same in a full-ink frame: an important way to another page, the default for `ButtonLink`), `text` (quiet control, burgundy underline on hover/focus), `outline` (forms), `line` (the older burgundy-rule CTA, kept for compatibility) |
| `Dialog` | Native modal `<dialog>`. Focus containment, Escape, focus return, inert page and scroll lock come from the platform. Used by the consultation panel and the work viewer. |
| `Reveal` | Rise-and-fade once on first view; static under reduced motion |
| `ResponsiveImage` | The one way to render a photograph (see the design system's image treatment) |
| `StateMessage` | The shared loading / empty / error pattern |
| `TextField` | A labelled text field, one line or several, that says when it is optional. Used by the consultation |

Add a primitive when a second real use appears, not before. Next likely: `Badge` for consultation status (Phase 7) and `Drawer` (if consultation becomes a side sheet).

## Data boundary

```
component  →  hook (useWork, useJournal, useCanvasCalls)  →  data/ (static today)  |  API (later)
```

- **Demo content is a state of the data, never of a component.** Testimonials, journal posts and canvas calls each have `status: 'awaiting' | 'demo' | 'published'` in their data file, and every fictional record carries `demo: true`. The pages label whatever is demo; they never decide what is real. Switching a source to `'awaiting'` hides its home preview and leaves its page saying nothing has been published; `'published'` records carry no `demo` mark. A canvas call's status is read as of today at the boundary (`statusOn`): an `open` call past its `deadline` is shown and treated as closed everywhere, so a stale record can never keep offering a response. Relationships are stored once in the data (a post's `callSlugs` and `workIds`, a call's `eventSlug` and `workIds`) and rendered wherever they apply.

- Components receive domain types (`TattooWork`) and an `AsyncState<T>`. They never import `data/`.
- `hooks/useWork` is the boundary. Today it returns the static archive synchronously, so there's no loading flash under the hero hand-off. When the archive moves to an API, only this hook changes: it fetches, aborts on unmount, and exposes `retry`. Every caller already handles `loading`, `error` and empty.
- `domain/` types are the contract with a future API. Optional fields mean "may not exist yet". Never fill them with guesses.
- When there are several resources and caching matters (Phase 5+), introduce a query library (e.g. TanStack Query) behind the same hooks. Don't add one before then.

## Tattoo metadata

> **The current metadata is temporary demo data.** It is fictional, it does not describe the photographs, and it must be replaced with metadata verified by Younes before launch.

**The model** (`domain/work.ts`): `TattooWork` is the photograph and its identity (`id`, `slug`, `title`, `image`, `alt`) plus `TattooTraits`. All traits are optional, and absent means "not known yet":

| Field | Type |
|---|---|
| `description` | Short text, in Younes's words |
| `subject`, `style`, `composition`, `linework`, `mood` | Lists from closed vocabularies (`TattooSubject`, `TattooStyle`, …) |
| `placement`, `colour` | One value each |
| `tags` | Free words for future search |

Every piece also carries a required `metadataStatus`:
- **`'demo'`:** sample values for building the product.
- **`'verified'`:** confirmed by Younes.

To add a word to a vocabulary, add it to its union type.

**Where the data lives:**
- `data/work.ts` builds the archive (ids, images, archive order).
- The traits come from `data/workDemoMetadata.ts`, a separate, clearly labelled demo file keyed by piece id. Every piece is marked `metadataStatus: 'demo'`.
- Both reach components only through `hooks/useWork`.

**Demo values are never shown as facts.** `verifiedFacts(piece)` is the only way the UI states a piece's style, placement or description, and it returns nothing unless the piece is verified. That is why Work Detail V1 keeps its "to be added by the studio" placeholders today. Demo values are used only for ordering Find Similar's suggestions. While they drive that order, Find Similar says so in one quiet line ("Ordered using sample descriptions · not yet confirmed by Younes").

**Matching** (`domain/workMatching.ts`, `rankByPreferences`): basic, deterministic metadata matching, not AI.
- **Scoring:** for each thing the visitor said speaks to them about the starting piece (subject, composition, linework, style, mood, placement), every other piece is compared with the starting piece on that trait:
  - **2 points:** it shares a value.
  - **1 point:** either side isn't described (unknown).
  - **0 points:** both are described and share nothing.
- **Missing data:** it never counts as a mismatch. It ranks between matches and known differences.
- **Ties:** go first to more shared values, then to archive order.
- **Something else:** "Something else" has no trait, so with no answers (or only that one) the archive order stands.

Find Similar's `suggestionPool` removes the starting piece and anything set aside, then ranks what's left. Keeping a piece never reorders anything. Changing the answers re-ranks from the first page; kept pieces stay kept.

**When the artist dashboard arrives:**
1. It writes verified traits for each piece through the API, with `metadataStatus: 'verified'`.
2. `hooks/useWork` fetches from it instead of the static files (see "Data boundary" above). Nothing in Find Similar, the matching or the detail changes.
3. Delete `data/workDemoMetadata.ts` and its spread in `data/work.ts`.
4. The demo line in Find Similar goes by itself: it shows only while demo records drive the order (`suggestionBasis`). No flag needs switching.
5. Verified style, placement and description then appear in Work Detail V1 in place of its placeholders.

Pieces can be verified one at a time. A verified piece may still have blanks, and they rank as unknown.

## Loading, empty, error, success

| State | Pattern |
|---|---|
| Loading | `<StateMessage kind="loading">`. For image-heavy layouts, reserve space with the real aspect ratios instead of spinners. |
| Empty | `<StateMessage kind="empty">` with one line in the site's voice and, where useful, a way forward |
| Error | `<StateMessage kind="error">` with `action` = retry when possible. Render errors inside a route land in `app/RouteError` (inside the layout, so the masthead stays). |
| Success | The content itself. No toasts or confirmations unless the user did something that needs acknowledging (e.g. submitting a consultation). |

## App-level state

- **Consultation:** `ConsultationProvider` (in `SiteLayout`) owns the single consultation dialog. Any page opens it with `useConsultation().open(entry)`, where `entry` says where the client came from (`hero`, `work`, `process`, `journal`, `footer`, `book`; `find-similar` + `workId` + `selection`; or `canvas-call` + `callSlug` + `title` + `demo`). A canvas call has its own draft (`canvas-call:<slug>`), like each Find Similar starting piece, so it never overwrites a general idea. Sections don't import the context; pages wire it into their props, so sections stay reusable.
  - **Drafts:** the provider keeps the client's drafts for the visit in memory (`consultation/consultationDraft.ts`): one general draft, and one per Find Similar starting piece.
  - **Domain vs UI:** each draft is a domain `Consultation` (`status: 'draft'`, `summary` holding the answers, `reviewedAt` once finished) plus UI state (the step, and whether a step was opened from the review).
  - **Find Similar's references:** they stay in `entry` and are read with `consultationReferences()`, so no form edit can overwrite them.
  - **The address:** an open consultation is one history entry, `?consult` (see [ROUTES.md](ROUTES.md)). `open` and `close` read the address only when called, so pages using them never re-render as it changes.
  - **Not built yet:** nothing is stored or sent. Submitting (Phase 7) will send this same `Consultation` (with `contact`) to the API and set `submittedAt`.
- **Find Similar:** `HomePage` and `WorkPage` each render `FindSimilar` and open it from the work detail. Which piece and which step are in the address (`?similar=03&step=pieces`, see [ROUTES.md](ROUTES.md)). What the client chose is local state in `FindSimilar`, a typed `FindSimilarSession`, kept while the page is open. Continuing hands a typed `FindSimilarSelection` to the consultation through the same `useConsultation().open(entry)`.
- **Hero → page:** the hero publishes `--hero-p` / `--hero-q` on `:root` for the nav and the Work hand-off. That is deliberately CSS, not React state, so scrolling never re-renders.
- Everything else is local component state. Add a global store only when two distant parts of the UI need the same changing data and props or context have become awkward.

## Environment and configuration

- Only `VITE_*` variables reach the browser, and they are **compiled into the public bundle**. They are typed in `src/vite-env.d.ts`, and the template is `.env.example`.
- Today there is one, unused: `VITE_API_BASE_URL`.
- **Secrets never go in `VITE_*`.** AI provider keys, search API keys and messaging tokens belong to the future server, which the site calls via `VITE_API_BASE_URL`.
- `.env` and `.env.*` are git-ignored, apart from `.env.example`.

## Accessibility

See the design system's accessibility section for the rules. Structurally:
- Dialogs are native.
- Focus styles are global (`base.css`).
- `sr-only` gives display type a plain-text equivalent.
- Decorative layers are `aria-hidden`.
- State messages carry live roles.

## Testing

There is no test framework yet, and it is deliberately not added in Phase 1. Today's gates are:

```bash
npm run build   # tsc -b (strict) + vite build
npm run lint    # oxlint (react, typescript, oxc; hooks rules)
```

Visual checks are done in a real browser at the listed sizes (see the design system's breakpoints), with reduced motion on and off.

When behaviour lands, add **Vitest + Testing Library** (unit and component) and **Playwright** (flows and visual regression). Test first:

| Area | What |
|---|---|
| Work filtering (Phase 2) | Filters only offer existing metadata; combinations; empty result |
| Find Similar (Phase 4) | From a piece, Find Similar opens on it; Back walks the steps; the consultation receives `{ from: 'find-similar', workId, selection }`. Checked with browser automation during development; not yet automated in the repo. |
| Consultation state (Phase 5) | Summary fills in, corrections apply, reference ordering (work → external → concept) |
| Summary rendering (Phase 6) | Every field optional; concept images always labelled |
| UI primitives | Dialog focus and Escape, Button variants, StateMessage roles |
| Responsive / visual | Hero and gallery screenshots at the five reference sizes, reduced motion on/off |
