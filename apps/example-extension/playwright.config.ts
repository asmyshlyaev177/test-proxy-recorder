import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: false,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'test-proxy-recorder https://x.com --port 8100 --dir ./e2e/recordings',
    url: 'http://127.0.0.1:8100/__control',
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'e2e',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
  ],
});
