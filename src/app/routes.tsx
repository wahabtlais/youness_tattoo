import type { RouteObject } from 'react-router';
import { SiteLayout } from './SiteLayout';
import { RouteError } from './RouteError';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * The public site's routes (docs/ROUTES.md). Pages are thin: they compose
 * sections and wire them to app-level services such as the consultation.
 * New pages that are not the landing page load lazily:
 *   { path: 'work/:slug', lazy: () => import('../pages/WorkDetailPage') }
 */
export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      {
        // errors render inside the layout, so the masthead stays
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
