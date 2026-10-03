import { Outlet } from 'react-router';
import { Nav } from '../components/layout/Nav';
import { RegistrationMarks } from '../components/layout/RegistrationMarks';
import { ConsultationProvider } from '../components/consultation/ConsultationProvider';

/** The frame every public page shares: masthead, print marks, consultation. */
export function SiteLayout() {
  return (
    <ConsultationProvider>
      <Nav />
      <RegistrationMarks />
      <main className="overflow-x-clip">
        <Outlet />
      </main>
    </ConsultationProvider>
  );
}
