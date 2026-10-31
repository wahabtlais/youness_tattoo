import { defineConfig } from 'vitest/config';

// The integration tests share one real Postgres database (younes_test),
// emptied between test files - so files run one at a time.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: 'test' },
  },
});
