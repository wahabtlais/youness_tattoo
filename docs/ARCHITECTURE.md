# Frontend architecture

React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, React Router 8, oxlint. There is no state library, backend or AI SDK. Each gets added when a phase actually needs it ([ROADMAP.md](ROADMAP.md)).

Related docs: [ROUTES.md](ROUTES.md) for routing, [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for tokens and visual rules, and [FUTURE_AI.md](FUTURE_AI.md) for the AI architecture.

## Layers

```
pages        compose sections for a route, and wire them to app services
  ↓
sections     one editorial part of a page (Hero, Work, Studio, Book)
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
├── pages/          HomePage, NotFoundPage - thin, one per route
├── sections/       Hero, Work, Studio, Book (+ Hero.css, Work.css)
├── components/
│   ├── ui/         Button, Dialog, Reveal, ResponsiveImage, StateMessage
│   ├── layout/     Nav, RegistrationMarks - the frame on every page
│   ├── hero/       the hero's planes: portrait, type, marks, ink, voice dial, cursor
│   ├── work/       WorkGallery, WorkItem, WorkMeta, WorkViewer
│   └── consultation/  ConsultationProvider + useConsultation, ConsultationPanel
├── domain/         TypeScript types for the product: work, consultation, client, media
├── hooks/          useWork (data boundary), useInView, useReducedMotion, hero engines
├── data/           static records (work, studio copy) - what an API replaces
├── lib/            tiny helpers: cx, AsyncState
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
| `sections/Hero.css` | Scroll choreography derived from one progress variable, registered masks, keyframed breathing, a pseudo-element-heavy voice dial. Its geometry variables (`--pcx`, `--ph`, `--ptop`, `--fs`, …) are shared with the ink. |
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

There are only five, built because existing code needed them:

| | |
|---|---|
| `Button` | `line` (burgundy rule + caps: the editorial CTA), `text` (quiet control), `outline` (forms) |
| `Dialog` | Native modal `<dialog>`. Focus containment, Escape, focus return, inert page and scroll lock come from the platform. Used by the consultation panel and the work viewer. |
| `Reveal` | Rise-and-fade once on first view; static under reduced motion |
| `ResponsiveImage` | The one way to render a photograph (see the design system's image treatment) |
| `StateMessage` | The shared loading / empty / error pattern |

Add a primitive when a second real use appears, not before. Next likely: `Input`/`Textarea` (Phase 5), `Badge` for consultation status (Phase 7) and `Drawer` (if consultation becomes a side sheet).

## Data boundary

```
component  →  hook (useWork)  →  data/ (static today)  |  API (later)
```

- Components receive domain types (`TattooWork`) and an `AsyncState<T>`. They never import `data/`.
- `hooks/useWork` is the boundary. Today it returns the static archive synchronously, so there's no loading flash under the hero hand-off. When the archive moves to an API, only this hook changes: it fetches, aborts on unmount, and exposes `retry`. Every caller already handles `loading`, `error` and empty.
- `domain/` types are the contract with a future API. Optional fields mean "may not exist yet". Never fill them with guesses.
- When there are several resources and caching matters (Phase 5+), introduce a query library (e.g. TanStack Query) behind the same hooks. Don't add one before then.

## Loading, empty, error, success

| State | Pattern |
|---|---|
| Loading | `<StateMessage kind="loading">`. For image-heavy layouts, reserve space with the real aspect ratios instead of spinners. |
| Empty | `<StateMessage kind="empty">` with one line in the site's voice and, where useful, a way forward |
| Error | `<StateMessage kind="error">` with `action` = retry when possible. Render errors inside a route land in `app/RouteError` (inside the layout, so the masthead stays). |
| Success | The content itself. No toasts or confirmations unless the user did something that needs acknowledging (e.g. submitting a consultation). |

## App-level state

- **Consultation:** `ConsultationProvider` (in `SiteLayout`) owns the single consultation dialog. Any page opens it with `useConsultation().open(entry)`, where `entry` says where the client came from (`hero`, `work`, `book`, or `find-similar` + `workId`). Sections don't import the context; pages wire it into their props, so sections stay reusable.
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
| Find Similar (Phase 4) | From a piece, the consultation opens with `{ from: 'find-similar', workId }`; deep link to `/work/:slug` |
| Consultation state (Phase 5) | Summary fills in, corrections apply, reference ordering (work → external → concept) |
| Summary rendering (Phase 6) | Every field optional; concept images always labelled |
| UI primitives | Dialog focus and Escape, Button variants, StateMessage roles |
| Responsive / visual | Hero and gallery screenshots at the five reference sizes, reduced motion on/off |
