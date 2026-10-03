# Routes

React Router 8 in data-router mode (`createBrowserRouter`). The route table is [`src/app/routes.tsx`](../src/app/routes.tsx).

## Shape

```
SiteLayout            Nav, RegistrationMarks, <main>, ConsultationProvider
└── (errorElement: RouteError, rendered inside the layout)
    ├── /             HomePage
    └── *             NotFoundPage
```

Pages are thin: they compose sections and wire them to app services (the consultation). No page holds the whole site.

## Planned routes

| Path | Page | Phase | Notes |
|---|---|---|---|
| `/` | Home: hero, work, studio, booking intro | Built | |
| `/work` | Full archive with filters | 2 | Only if the home wall stops being enough. Otherwise `/#work`. |
| `/work/:slug` | Tattoo detail: large image, real metadata, related work, **Find Similar** | 3 | `slug` is on `TattooWork` today (equal to `id`). Replaces the viewer dialog as the shareable view; the dialog can stay as a quick look. |
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
