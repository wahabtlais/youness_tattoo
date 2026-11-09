// Pre-renders the home page's first screen into the built index.html, so the
// hero paints before any JavaScript has downloaded (Phase 1b).
//
//   node scripts/prerender-hero.mjs [distDir]      (default: dist; run after `vite build`)
//
// 1. builds src/prerender/heroShell.tsx for Node (Vite SSR build: the same
//    components, and the same hashed asset URLs as the client build)
// 2. renders it to static HTML
// 3. writes it into <template id="hero-shell"> after #root, with a small
//    inline script that copies it into #root - only on the home page and a
//    piece's address (/work/:slug), which open on the hero - while the page
//    is still being parsed. The app's first render replaces it (createRoot
//    clears its container): no hydration, nothing to mismatch.
// 4. the same markup in a <noscript>, for a browser without JavaScript (with
//    JavaScript it is inert text: nothing in it loads).
// The server's Content-Security-Policy hashes every inline script in
// dist/index.html when it starts (server/src/modules/content/site.ts), so
// the new script needs no configuration.
import { build } from 'vite';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(ROOT, process.argv[2] ?? 'dist');
const out = path.join(ROOT, 'node_modules/.cache/hero-shell');

await build({
  root: ROOT,
  logLevel: 'warn',
  configFile: path.join(ROOT, 'vite.config.ts'),
  build: { ssr: path.join(ROOT, 'src/prerender/heroShell.tsx'), outDir: out, emptyOutDir: true, copyPublicDir: false },
});
const entry = readdirSync(out).find((f) => /^heroShell\.(m?js)$/.test(f));
if (!entry) throw new Error(`no SSR output in ${out}`);
const { renderHeroShell } = await import(pathToFileURL(path.join(out, entry)).href);
const shell = renderHeroShell();
await rm(out, { recursive: true, force: true });

const file = path.join(dist, 'index.html');
let html = await readFile(file, 'utf8');
if (html.includes('id="hero-shell"')) throw new Error('index.html already has a pre-rendered hero');
const ROOT_DIV = '<div id="root"></div>';
if (!html.includes(ROOT_DIV)) throw new Error('no <div id="root"></div> in index.html');
html = html.replace(
  ROOT_DIV,
  `${ROOT_DIV}
    <template id="hero-shell">${shell}</template>
    <script>
      (function () {
        var p = location.pathname;
        if (p !== '/' && !/^\\/work\\/[^/]+\\/?$/.test(p)) return;
        var t = document.getElementById('hero-shell');
        document.getElementById('root').appendChild(t.content.cloneNode(true));
        document.documentElement.setAttribute('data-hero-shell', '');
      })();
    </script>
    <noscript>${shell}</noscript>`,
);
await writeFile(file, html);
console.log(`pre-rendered hero: ${(shell.length / 1024).toFixed(1)} KB of HTML -> ${path.relative(ROOT, file)}`);
