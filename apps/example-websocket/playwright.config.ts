import { defineConfig, devices } from '@playwright/test';

const APP_PORT = process.env.APP_PORT || '4173';
const PROXY_PORT = process.env.TEST_PROXY_RECORDER_PORT || '8100';

// The built app (VITE_WS_URL baked to the proxy by `build:test`) is served by
// `vite preview`; the proxy records/replays the Binance WebSocket feed.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // No --port: the CLI reads TEST_PROXY_RECORDER_PORT itself, as the fixture does.
      command: 'pnpm proxy',
      url: `http://localhost:${PROXY_PORT}/__control`,
      // Another project's proxy on this port would be driven silently, with the
      // wrong target and recordings dir. Move the port with TEST_PROXY_RECORDER_PORT.
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'pnpm preview',
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
