import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

import { authStatePath } from './e2e/auth-state-path';

// Load .env / .env.local (Cognito region, client id, test credentials) the same
// way Next does — so `pnpm test:e2e` works locally without exporting vars in every
// shell. Already-exported env vars (and CI-injected ones) still take precedence.
loadEnvConfig(process.cwd());

const APP_PORT = process.env.APP_PORT || 3200;
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
    // Logs in to Cognito once, with the proxy in TRANSPARENT mode, and saves
    // storageState to the gitignored e2e/auth-state.json. See e2e/setup-auth.ts.
    { name: 'setup', testMatch: /setup-auth\.ts/ },
    // The real specs — pre-authenticated via that storageState, recording/replaying.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authStatePath },
      dependencies: ['setup'],
    },
  ],
});
