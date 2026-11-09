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
          // a client's way in (signing in, creating an account, confirming the email, a new password) - on the site's own pages,
          // so a consultation begun on the site is kept while they sign in
          ...['/account', '/account/verify', '/account/forgot', '/account/reset'].map((path) => ({ path, lazy: async () => ({ Component: (await import('../pages/AccountPage')).AccountPage }) })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  // the client portal (src/portal): a client's own pages - their own frame, loaded only when visited
  {
    path: '/portal',
    lazy: async () => ({ Component: (await import('../portal/PortalLayout')).PortalLayout }),
    hydrateFallbackElement: <div className="min-h-svh bg-paper" />,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../portal/pages/OverviewPage')).OverviewPage }) },
      { path: 'projects', lazy: async () => ({ Component: (await import('../portal/pages/ProjectsPage')).ProjectsPage }) },
      { path: 'projects/:projectId', lazy: async () => ({ Component: (await import('../portal/pages/ProjectsPage')).ProjectPage }) },
      { path: 'requests', lazy: async () => ({ Component: (await import('../portal/pages/RequestsPage')).RequestsPage }) },
      { path: 'requests/new', lazy: async () => ({ Component: (await import('../portal/pages/RequestsPage')).BookingRequestPage }) },
      { path: 'requests/:requestId', lazy: async () => ({ Component: (await import('../portal/pages/RequestsPage')).RequestPage }) },
      { path: 'appointments', lazy: async () => ({ Component: (await import('../portal/pages/AppointmentsPage')).AppointmentsPage }) },
      { path: 'aftercare', lazy: async () => ({ Component: (await import('../portal/pages/AftercarePage')).AftercarePage }) },
      { path: 'profile', lazy: async () => ({ Component: (await import('../portal/pages/ProfilePage')).ProfilePage }) },
    ],
  },
  // the private studio dashboard (src/dashboard): its own frame, none of the
  // site's, and loaded only when visited - nothing of it is in the public bundle
  {
    path: '/studio',
    lazy: async () => {
      const [{ DashboardLayout }, { DashboardError }] = await Promise.all([import('../dashboard/DashboardLayout'), import('../dashboard/DashboardError')]);
      return { Component: DashboardLayout, ErrorBoundary: DashboardError };
    },
    // transparent: the page's own background shows, already in the studio's theme (index.html)
    hydrateFallbackElement: <div className="min-h-svh" />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../dashboard/pages/OverviewPage')).OverviewPage }) },
      // Inquiries, category first: the categories, a category's list, an inquiry. The deeper
      // addresses are children that draw nothing themselves - the page reads them - so it stays
      // mounted across all three (its search and prototype edits with it)
      {
        path: 'inquiries',
        lazy: async () => ({ Component: (await import('../dashboard/pages/InquiriesPage')).InquiriesPage }),
        children: [
          { path: ':category', element: null },
          { path: ':category/:inquiryId', element: null },
        ],
      },
      // the other sections - each a lazy page; deeper addresses (a client, a piece, a post) are read by the page itself
      { path: 'clients', lazy: async () => ({ Component: (await import('../dashboard/pages/ClientsPage')).ClientsPage }), children: [{ path: ':clientId', element: null }] },
      { path: 'projects', lazy: async () => ({ Component: (await import('../dashboard/pages/ProjectsPage')).ProjectsPage }), children: [{ path: ':projectId', element: null }] },
      { path: 'aftercare', lazy: async () => ({ Component: (await import('../dashboard/pages/AftercarePage')).AftercarePage }) },
      { path: 'calendar', lazy: async () => ({ Component: (await import('../dashboard/pages/CalendarPage')).CalendarPage }) },
      { path: 'portfolio', lazy: async () => ({ Component: (await import('../dashboard/pages/PortfolioPage')).PortfolioPage }), children: [{ path: ':pieceId', element: null }] },
      {
        path: 'publishing',
        lazy: async () => ({ Component: (await import('../dashboard/pages/PublishingPage')).PublishingPage }),
        children: [
          { path: ':type', element: null },
          { path: ':type/:slug', element: null },
        ],
      },
      { path: 'website', lazy: async () => ({ Component: (await import('../dashboard/pages/WebsitePage')).WebsitePage }) },
      { path: 'assistant', lazy: async () => ({ Component: (await import('../dashboard/pages/AssistantPage')).AssistantPage }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('../dashboard/pages/SettingsPage')).SettingsPage }) },
      { path: ':section', lazy: async () => ({ Component: (await import('../dashboard/pages/SectionPlaceholder')).SectionPlaceholder }) },
      // deeper unknown addresses stay inside the studio frame
      { path: '*', lazy: async () => ({ Component: (await import('../dashboard/pages/SectionPlaceholder')).SectionPlaceholder }) },
    ],
  },
];
