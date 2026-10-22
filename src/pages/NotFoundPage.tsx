import { NotFound } from '../components/layout/NotFound';

/** Any address the site doesn't have. */
export function NotFoundPage() {
  return (
    <NotFound
      title="There’s nothing printed on this page."
      links={[
        { to: '/', label: 'Back to the studio' },
        { to: '/work', label: 'See the work' },
        { to: '/journal', label: 'Read the journal' },
      ]}
    />
  );
}
