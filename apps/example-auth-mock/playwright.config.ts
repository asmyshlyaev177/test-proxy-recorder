import { defineConfig, devices } from '@playwright/test';

import { authStatePath } from './e2e/auth-state-path';

const APP_PORT = process.env.APP_PORT || 3100;
const isRecord = !!process.env.RECORD_MODE;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: !isRecord,
  retries: 0,
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Logs in once, with the proxy in TRANSPARENT mode, and saves storageState
    // to the gitignored e2e/auth-state.json. The login flow is never recorded.
    // See e2e/setup-auth.ts.
    { name: 'setup', testMatch: /setup-auth\.ts/ },
    // The real specs — pre-authenticated via that storageState, recording/replaying.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authStatePath },
      dependencies: ['setup'],
    },
  ],
});
