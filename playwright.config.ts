import { defineConfig } from '@playwright/test';

/**
 * Browser tests: the site and the studio, end to end, against the real
 * API on the real (test) PostgreSQL database - see server/test/e2e-server.ts.
 * Their own ports (API 3101, site 5301), so a running dev setup (3001 /
 * 5201) is left alone. Uses the installed Chrome; nothing is downloaded.
 *
 *   npm run test:e2e
 */
const API_PORT = 3101;
const SITE = 'http://localhost:5301';

export default defineConfig({
  testDir: 'tests/e2e',
  // one database, shared: the files run in order, one at a time
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { baseURL: SITE, channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'e2e', testMatch: /\.spec\.ts/, dependencies: ['setup'], use: { storageState: 'test-results/e2e-owner.json' } },
  ],
  webServer: [
    {
      command: 'npx tsx --import ./src/db/seed/register-assets.mjs test/e2e-server.ts',
      cwd: 'server',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_ORIGIN: SITE },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --port 5301 --strictPort',
      url: SITE,
      env: { YOUNES_API: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
