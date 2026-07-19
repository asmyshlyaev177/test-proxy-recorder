import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
const BACKEND_URL = 'http://localhost:3002';

async function seed(text: string) {
  const del = await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
  if (!del.ok) throw new Error(`seed DELETE failed: ${del.status} ${del.statusText}`);
  const post = await fetch(`${BACKEND_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!post.ok) throw new Error(`seed POST failed: ${post.status} ${post.statusText}`);
}

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay');
});

// The /isr route serves cache headers (public, s-maxage=30, stale-while-revalidate)
// — TanStack Start's CDN-based ISR. This proves the recorder coexists with a
// cached route: the SSR fetch (the `fetchIsrTodos` server function) is tagged via
// registerProxyFetch() in src/router.tsx, so record captures it and parallel
// replay serves it from the right session.
test('ISR page renders todos recorded through the proxy', async ({ page }) => {
  if (mode === 'record') {
    await seed('ISR-todo');
  }

  // In production a CMS webhook hits this to purge the CDN when data changes.
  // The shared secret is attached automatically via extraHTTPHeaders
  // (playwright.config.ts), so the spec never handles it. Assert it succeeded: a
  // silent 401 would mean the endpoint's auth is misconfigured.
  const revalidated = await page.request.post('/api/revalidate');
  expect(revalidated.ok()).toBeTruthy();

  // No CDN in the test runtime, so the loader re-runs and the SSR fetch flows
  // through the proxy — a single request returns the recorded data, no polling.
  await page.goto('/isr');
  const items = page.getByTestId('todo-text');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveText('ISR-todo');
});
