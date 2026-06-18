```ts
// e2e/my.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Full-stack: the browser also talks to the proxy, so match its URL.
// (Browser-only app? Match your real API domain instead, e.g. /api\.example\.com/.)
const CLIENT_SIDE_URL = /localhost:8100/;

// 'record' hits the real API and saves responses.
// 'replay' serves them from disk — no network needed.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```
