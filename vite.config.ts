import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { injectContent } from "@younes/contracts";

/** where the API listens in development (server/.env PORT) */
const API = process.env.YOUNES_API ?? "http://127.0.0.1:3001";

/**
 * Development only: the API writes the published content into the page it
 * serves (server/src/modules/content/site.ts); here Vite serves the page,
 * so this does the same - fetching the published bundle and inserting it
 * before </head>. If the API isn't running, the page is served without it
 * and the site falls back to its bundled content.
 */
function publishedContent(): Plugin {
  return {
    name: "younes-published-content",
    apply: "serve",
    async transformIndexHtml(html) {
      try {
        const res = await fetch(`${API}/api/public/content`, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) return html;
        return injectContent(html, await res.json());
      } catch {
        return html;
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), publishedContent()],
  server: {
    allowedHosts: ["hunter-some-exit-arg.trycloudflare.com"],
    // the API and its media, on the same origin as the site (cookies, no CORS)
    proxy: {
      "/api": { target: API, changeOrigin: false },
      "/media": { target: API, changeOrigin: false },
    },
  },
});
