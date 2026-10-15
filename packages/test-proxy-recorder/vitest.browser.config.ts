import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

// The tests that drive real Chromium. Kept out of `pnpm test` so it needs no
// browser install; CI runs them in the Playwright container with the e2e suites.
// A spread, not mergeConfig, because mergeConfig concatenates the include and
// exclude lists and the base exclude would win.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.browser.test.ts'],
    exclude: [],
  },
});
