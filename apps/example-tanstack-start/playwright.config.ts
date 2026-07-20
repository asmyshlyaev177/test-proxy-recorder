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
} catch (err) {
  // A missing .env.local is the normal case — the Cognito auth suite is simply
  // skipped (see below). Surface anything else (a malformed file, a permission
  // error, or `process.loadEnvFile` being unavailable on Node < 20.12) so it
  // isn't silently swallowed and mistaken for "no credentials".
  if ((err as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
    console.warn(
      `[playwright.config] Could not load .env.local: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const revalidateToken = process.env.REVALIDATE_SECRET ?? '';

// The Cognito auth suite (setup-auth.ts + auth.spec.ts) needs a real test user
// AND the public pool config (VITE_COGNITO_*), which is baked into the app at
// build time and read by the login page. We require BOTH: with the test user but
// no pool config, the login can't configure Cognito and setup-auth would time out
// on the /dashboard redirect — better to skip cleanly. Without either, a fresh
// clone (and forks without secrets) still replays every other spec offline.
const hasCognito = !!(
  process.env.COGNITO_TEST_EMAIL &&
  process.env.COGNITO_TEST_PASSWORD &&
  process.env.VITE_COGNITO_REGION &&
  process.env.VITE_COGNITO_CLIENT_ID
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
