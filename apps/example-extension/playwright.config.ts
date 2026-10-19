import { defineConfig } from '@playwright/test';

const PROXY_PORT = process.env.TEST_PROXY_RECORDER_PORT || '8100';

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
    // No --port: the CLI reads TEST_PROXY_RECORDER_PORT itself, as the fixture does.
    command: 'test-proxy-recorder https://x.com --dir ./e2e/recordings',
    url: `http://127.0.0.1:${PROXY_PORT}/__control`,
    // Another project's proxy on this port would be driven silently, with the
    // wrong target and recordings dir. Move the port with TEST_PROXY_RECORDER_PORT.
    reuseExistingServer: false,
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
