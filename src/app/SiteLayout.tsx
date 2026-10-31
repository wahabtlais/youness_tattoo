import { Outlet } from 'react-router';
import { Footer } from '../components/layout/Footer';
import { Nav } from '../components/layout/Nav';
import { RegistrationMarks } from '../components/layout/RegistrationMarks';
import { ScrollManager } from '../components/layout/ScrollManager';
import { ConsultationProvider } from '../components/consultation/ConsultationProvider';

/** The frame every public page shares: masthead, print marks, footer, consultation. */
export function SiteLayout() {
  return (
    <ConsultationProvider>
      <ScrollManager />
      <Nav />
      <RegistrationMarks />
      <main className="overflow-x-clip">
        <Outlet />
      </main>
      <Footer />
    </ConsultationProvider>
  );
}
