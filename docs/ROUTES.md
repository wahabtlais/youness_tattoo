# Routes

React Router 8 in data-router mode (`createBrowserRouter`). The route table is [`src/app/routes.tsx`](../src/app/routes.tsx).

## Shape

```
SiteLayout            Nav, RegistrationMarks, <main>, ConsultationProvider
└── (errorElement: RouteError, rendered inside the layout)
    ├── /             HomePage
    │   └── work/:slug    (no element) the piece's detail, opened over the archive
    └── *             NotFoundPage
```

Pages are thin: they compose sections and wire them to app services (the consultation). No page holds the whole site.

## Planned routes

| Path | Page | Phase | Notes |
|---|---|---|---|
| `/` | Home: hero, work, studio, booking intro | Built | |
| `/work` | Full archive with filters | 2 | Only if the home wall stops being enough. Otherwise `/#work`. |
| `/work/:slug` | Tattoo detail: large image, metadata, other pieces, **Find Similar** | Built | A child of `/` with no element: the physical archive reads the slug and opens its detail over itself, so the archive never remounts. Unknown slugs go to `/`. See [PROTOTYPE_PHYSICAL_ARCHIVE.md](PROTOTYPE_PHYSICAL_ARCHIVE.md#the-detail). |
| `…?similar=:id` (`&step=pieces`) | **Find Similar**, as a sheet over the page it opened from (normally `/work/:slug`) | Built | A search parameter, not a route, so the detail and the archive underneath are untouched. Each step is pushed, so Back walks back to the piece. A reload or link straight to it drops back to the piece (the detail opens a moment later and would cover the sheet), and an unknown id is dropped. |
| `…?consult` | The guided consultation, as a sheet over the page it opened from | Built | One history entry for the whole consultation, so Back closes it, keeping the draft. Steps stay inside the sheet. Other parameters (and Find Similar's history state) are kept. A reload drops it, since drafts aren't stored. |
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
