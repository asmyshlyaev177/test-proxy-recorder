import { defineConfig, devices } from '@playwright/test';

const APP_PORT = process.env.APP_PORT || 3000;
const isRecord = !!process.env.RECORD_MODE;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: !isRecord,
  retries: 0,
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
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
