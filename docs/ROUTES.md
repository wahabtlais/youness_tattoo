# Routes

React Router 8 in data-router mode (`createBrowserRouter`). The route table is [`src/app/routes.tsx`](../src/app/routes.tsx).

## Shape

```
SiteLayout            ScrollManager, Nav, RegistrationMarks, <main>, Footer, ConsultationProvider
└── (errorElement: RouteError, rendered inside the layout; hydrateFallbackElement: plain paper)
    ├── /                     HomePage
    │   └── work/:slug            UnknownPiece: nothing for a real piece (the archive opens its detail); a not-found sheet otherwise
    ├── /work                 WorkPage            (lazy) the portfolio; a piece opens over it as ?piece=:slug
    ├── /journal              JournalPage         (lazy) ?kind= filters by category
    ├── /journal/:slug        JournalPostPage     (lazy)
    ├── /canvas-calls         CanvasCallsPage     (lazy)
    ├── /canvas-calls/:slug   CanvasCallPage      (lazy)
    └── *                     NotFoundPage
```

**Scrolling** (`components/layout/ScrollManager`): arriving on another page starts at its top; a section link such as `/#studio` scrolls to it from any page (re-placing it while the home page settles); moving within a page (a piece's detail over the archive, `?piece`, `?similar`, `?consult`) keeps the scroll; Back and Forward keep the browser's own restoration.

**Navigation** (`components/layout/siteLinks.ts`, shared by the masthead, its menu and the footer): the official logo (home) and the pages only: Work `/work` · Journal `/journal` · Canvas calls `/canvas-calls`. No anchors into the home page and no consultation button in the masthead: the page's own invitations and the footer carry the consultation. The page you are on is marked (`aria-current`). Below 900px the links fold into a "Menu" sheet.

Pages are thin: they compose sections and wire them to app services (the consultation). No page holds the whole site.

**Not found** (`components/layout/NotFound`): one editorial pattern for every miss - "/ 404 · Not found", a serif heading saying what wasn't found, a line of explanation, and real links on; the tab reads "Not found — Younes Tattoo". Unknown addresses (`NotFoundPage`: home, work, journal), unknown posts (journal, home), unknown calls (canvas calls, home), unknown pieces (above). A portfolio link with an unknown `?piece=` shows the grid with a note ("There's no piece "99" in the portfolio.") and a Dismiss that clears it. No miss ever shows a stand-in record.

### Why a piece has two addresses

Both are deliberate and kept:
- **`/work/:slug`** is the piece's permanent, shareable address. It opens over the home page's physical archive, because that is where the approved pick-and-return choreography lives: the archive reads the slug, flies the print in, and on close returns it to its clip. Moving the detail to another page would mean rebuilding that choreography.
- **`/work?piece=:slug`** is the same Work Detail V1 opened over the portfolio grid, so closing returns you to the grid where you were (with your filters), not to the home page. A search parameter keeps the archive's route and its timing untouched.

Both survive a reload, close with Escape, Close, an outside click or Back, return focus to what opened them, and hand on to Find Similar and the consultation. The canonical address to share is `/work/:slug`.

## Planned routes

| Path | Page | Phase | Notes |
|---|---|---|---|
| `/` | Home: hero, work (the archive), the artist, client experiences, the process, journal and canvas-call previews, book | Built | |
| `/work` | **The portfolio**: a search field, four filter menus (`?q=`, `?style=`, `?subject=`, `?placement=`, `?colour=`, comma-separated), the pieces nine to a page (`?page=2`…) | Built | Search and filters replace the current history entry and reset to page 1; a page turn pushes one, so Back / Forward walk the pages. A page that doesn't exist (an old link, or fewer results now) is clamped and the address corrected. Filters appear only for facets the data describes, and say so while the metadata is demo data. A reload or shared link restores the whole view. In development only, `?pageSize=3` overrides the page size so paging can be tested on today's eight real pieces. |
| `/work?piece=:slug` | A piece's detail (Work Detail V1) over the portfolio, with Find Similar | Built | Opening pushes an entry, so Back closes it; a link straight to it opens it and Close replaces the entry. Focus returns to the piece in the grid. The canonical address of a piece stays `/work/:slug` (over the home archive): the portfolio uses a search parameter so the archive's own route and its choreography are untouched. |
| `/work/:slug` | Tattoo detail: large image, metadata, other pieces, **Find Similar** | Built | A child of `/` with no element: the physical archive reads the slug and opens its detail over itself, so the archive never remounts. An unknown slug keeps its address and says "That piece isn't in the archive." in a sheet over the home page, with links to the portfolio and home; Escape or Close goes home. See [PROTOTYPE_PHYSICAL_ARCHIVE.md](PROTOTYPE_PHYSICAL_ARCHIVE.md#the-detail). |
| `…?similar=:id` (`&step=pieces`) | **Find Similar**, as a sheet over the page it opened from (normally `/work/:slug`) | Built | A search parameter, not a route, so the detail and the archive underneath are untouched. Each step is pushed, so Back walks back to the piece. A reload or link straight to it drops back to the piece (the detail opens a moment later and would cover the sheet), and an unknown id is dropped. |
| `…?consult` | The guided consultation, as a sheet over the page it opened from | Built | One history entry for the whole consultation, so Back closes it, keeping the draft. Steps stay inside the sheet. Other parameters (and Find Similar's history state) are kept. A reload drops it, since drafts aren't stored. |
| `/journal` | **Journal**: Upcoming (dated like a programme), Recent (one feature, then a column), Archive (an index); `?kind=` filters by category | Built | Demo posts today, labelled. |
| `/journal/:slug` | A post: category, date, headline, event details, picture, story, related canvas calls and pieces, older / newer | Built | Unknown slugs say so and link back to the Journal. |
| `/canvas-calls` | **Canvas Calls**: open and upcoming calls set large with their particulars; filled and closed listed below | Built | Demo calls today, labelled. |
| `/canvas-calls/:slug` | A call in full and the next step: an open call opens the consultation with the call attached; any other offers a general consultation | Built | Unknown slugs say so and link back. |
| `/consultation` | Consultation (if it outgrows the dialog) | 5 | Takes the entry via search params, e.g. `?from=find-similar&work=03` |
| `/consultation/:id` | Summary and status for a submitted consultation | 6–7 | Needs the API; reached through a private link |
| `/studio` | Studio / about Younes | 8 | Only once real content exists |
| `/booking` | Booking information (no payments) | 9 | |
| `/aftercare` | Aftercare information | later | |

The artist dashboard will be a **separate app or a separately protected route tree** (e.g. `/studio-os/*`). It must never ship in the public bundle. See [FUTURE_AI.md](FUTURE_AI.md).

## Conventions

- Every page except Home loads lazily:
  ```ts
  { path: 'work/:slug', lazy: () => import('../pages/WorkDetailPage') }
  ```
- Page data comes through hooks (see [ARCHITECTURE.md](ARCHITECTURE.md)), not route loaders, until there is a real API. Moving a hook into a `loader` later is a local change.
- Use `<Link>` for internal navigation. Section anchors in the nav (`#work`, `#studio`, `#book`) are home-page anchors; once other pages exist they become `/#work`, etc.
- Set per-page titles and meta with React 19's `<title>` / `<meta>` in the page component.
- Add `<ScrollRestoration />` to `SiteLayout` when the second real page exists.

## Hosting

This is a single-page app with browser history routing: the host must serve `index.html` for unknown paths (an SPA fallback or rewrite). `vite preview` and the dev server already do this.
