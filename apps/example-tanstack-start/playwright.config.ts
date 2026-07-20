import { defineConfig, devices } from '@playwright/test';

import { authStatePath } from './e2e/auth-state-path';

const APP_PORT = process.env.APP_PORT || 3000;
const isRecord = !!process.env.RECORD_MODE;

// Load the example app's committed .env (Node >=20.12 built-in). This is the
// single source of truth for REVALIDATE_SECRET — the app's start script also
// loads it, and we load it here so the Playwright side can attach it to the
// on-demand revalidation request without the test spec ever touching the secret.
try {
  process.loadEnvFile('.env');
} catch {
  // Missing .env is fine for suites that don't hit /api/revalidate.
}
// Also load .env.local (gitignored) for the Cognito test-user credentials, so the
// auth suite runs locally without exporting vars in every shell. Already-set env
// vars (CI secrets) take precedence.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local — the Cognito auth suite is simply skipped (see below).
}

const revalidateToken = process.env.REVALIDATE_SECRET ?? '';

// The Cognito auth suite (setup-auth.ts + auth.spec.ts) needs a real test user.
// Without credentials it's skipped entirely, so a fresh clone still replays every
// other spec offline. With creds (`.env.local` or CI secrets) it records/replays
// the authenticated dashboard. Forks without secrets get the rest of the suite green.
const hasCognito = !!(
  process.env.COGNITO_TEST_EMAIL && process.env.COGNITO_TEST_PASSWORD
);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: !isRecord,
  retries: 0,
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    // Attached to every APIRequestContext call (e.g. page.request.post). The
    // /api/revalidate route requires it; the rest of the app ignores it.
    extraHTTPHeaders: revalidateToken
      ? { 'x-revalidate-token': revalidateToken }
      : {},
  },
  webServer: [],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The auth suite runs in its own pre-authenticated project (below), never here.
      testIgnore: [/setup-auth\.ts/, /auth\.spec\.ts/],
    },
    // Cognito auth suite — only when credentials are available. `setup` logs in
    // once (proxy in transparent mode) and saves storageState; `auth` reuses it,
    // starting already authenticated.
    ...(hasCognito
      ? [
          { name: 'setup', testMatch: /setup-auth\.ts/ },
          {
            name: 'auth',
            testMatch: /auth\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], storageState: authStatePath },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
});
