import type { RouteObject } from 'react-router';
import { SiteLayout } from './SiteLayout';
import { RouteError } from './RouteError';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * The public site's routes (docs/ROUTES.md). Pages are thin: they compose
 * sections and wire them to app-level services such as the consultation.
 * New pages that are not the landing page load lazily.
 *
 * /work/:slug is a piece's detail. It is a child of the home page with no
 * element of its own: the detail opens over the physical archive (which
 * reads the slug), so moving between / and /work/:slug never remounts the
 * archive, its rope or the loaded 3D arm.
 */
export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      {
        // errors render inside the layout, so the masthead stays
        errorElement: <RouteError />,
        children: [
          // the detail renders over the archive, so its route renders nothing itself
          { path: '/', element: <HomePage />, children: [{ path: 'work/:slug', element: null }] },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
