import { defineConfig, devices } from '@playwright/test';

// The built app (VITE_WS_URL baked to the proxy by `build:test`) is served by
// `vite preview`; the proxy records/replays the Coinbase WebSocket feed.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm proxy',
      url: 'http://localhost:8100/__control',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'pnpm preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
