```ts
// e2e/my.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// The external API(s) your browser talks to.
const CLIENT_SIDE_URL = /api\.example\.com/;

// 'record' hits the real API and saves responses.
// 'replay' serves them from disk — no network needed.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```
