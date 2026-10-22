import type { RouteObject } from 'react-router';
import { SiteLayout } from './SiteLayout';
import { RouteError } from './RouteError';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { UnknownPiece } from '../components/work/UnknownPiece';

/**
 * The public site's routes (docs/ROUTES.md). Pages are thin: they compose
 * sections and wire them to app-level services such as the consultation.
 * Every page except the landing page loads lazily.
 *
 * /work/:slug is a piece's detail. It is a child of the home page with no
 * element of its own: the detail opens over the physical archive (which
 * reads the slug), so moving between / and /work/:slug never remounts the
 * archive, its rope or the loaded 3D arm. /work (no slug) is the portfolio
 * page, a separate route; a piece opened there is ?piece=:slug.
 */
export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      {
        // errors render inside the layout, so the masthead stays
        errorElement: <RouteError />,
        // a lazily loaded page arriving on first load: plain paper under the masthead
        hydrateFallbackElement: <div className="min-h-svh bg-paper" />,
        children: [
          // the detail renders over the archive, so its route renders nothing
          // itself - except to say so when the piece doesn't exist
          { path: '/', element: <HomePage />, children: [{ path: 'work/:slug', element: <UnknownPiece /> }] },
          { path: '/work', lazy: async () => ({ Component: (await import('../pages/WorkPage')).WorkPage }) },
          { path: '/journal', lazy: async () => ({ Component: (await import('../pages/JournalPage')).JournalPage }) },
          { path: '/journal/:slug', lazy: async () => ({ Component: (await import('../pages/JournalPostPage')).JournalPostPage }) },
          { path: '/canvas-calls', lazy: async () => ({ Component: (await import('../pages/CanvasCallsPage')).CanvasCallsPage }) },
          { path: '/canvas-calls/:slug', lazy: async () => ({ Component: (await import('../pages/CanvasCallPage')).CanvasCallPage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
