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

// The /isr page caches its upstream fetch for 30s via `fetch` with
// `next.revalidate`. This proves the recorder coexists with a cached ISR route:
// the SSR fetch is tagged via registerProxyFetch() (which reads headers() in the
// request scope), so record captures it and parallel replay serves it from the
// right session.
test('ISR page renders todos recorded through the proxy', async ({ page }) => {
  if (mode === 'record') {
    await seed('ISR-todo');
  }

  // Drop the 30s upstream cache so the next request re-runs the SSR fetch through
  // the proxy. In production a CMS webhook would hit this when the data changes;
  // here it also clears the cache left from the record phase so replay rebuilds
  // the page from the recording instead of serving a stale cache hit. The shared
  // secret is attached automatically via extraHTTPHeaders (playwright.config.ts),
  // so the spec never handles it. Assert it succeeded: a silent 401 would leave
  // the stale cache in place and let the test pass without exercising the proxy.
  const revalidated = await page.request.post('/api/revalidate');
  expect(revalidated.ok()).toBeTruthy();

  // revalidateTag is a hard invalidation (not stale-while-revalidate), and the
  // patched fetch makes the page render dynamically during tests, so a single
  // request returns the fresh (recorded) data — no polling needed.
  await page.goto('/isr');
  const items = page.getByTestId('todo-text');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveText('ISR-todo');
});
