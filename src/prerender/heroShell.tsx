import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { Nav } from '../components/layout/Nav';
import { RegistrationMarks } from '../components/layout/RegistrationMarks';
import { Hero } from '../sections/Hero';

/**
 * The home page's first screen as static HTML - the masthead, the print
 * marks and the hero, rendered by the very components the app uses, in the
 * order SiteLayout puts them in #root - so a visitor sees the hero (and its
 * portrait starts downloading) before any JavaScript has run.
 * scripts/prerender-hero.mjs builds this module for Node, calls it, and
 * writes the result into dist/index.html; the app's first render replaces it.
 * The hero's interactive parts stay inert until then.
 */
export function renderHeroShell(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Nav />
      <RegistrationMarks />
      <main className="overflow-x-clip">
        <Hero onAsk={() => {}} />
      </main>
    </StaticRouter>,
  );
}
