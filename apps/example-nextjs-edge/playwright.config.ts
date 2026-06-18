import { defineConfig, devices } from '@playwright/test';

const APP_PORT = process.env.APP_PORT || 3010;
const isRecord = !!process.env.RECORD_MODE;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Replay runs fully parallel — this is what creates *concurrent* proxy
  // sessions, which is exactly the condition under which the proxy needs the
  // recording-id header to tell SSR requests apart. Record runs single-worker.
  fullyParallel: !isRecord,
  workers: isRecord ? 1 : undefined,
  retries: 0,
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
