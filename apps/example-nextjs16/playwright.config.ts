import { defineConfig, devices } from '@playwright/test';

const APP_PORT = process.env.APP_PORT || 3000;
const isRecord = !!process.env.RECORD_MODE;

// Load the example app's committed .env (Node >=20.12 built-in). This is the
// single source of truth for REVALIDATE_SECRET — `next start` loads the same
// file natively, and we load it here so the Playwright side can attach it to the
// on-demand revalidation request without the test spec ever touching the secret.
try {
  process.loadEnvFile('.env');
} catch {
  // Missing .env is fine for suites that don't hit /api/revalidate.
}

const revalidateToken = process.env.REVALIDATE_SECRET ?? '';

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
  webServer: [
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
