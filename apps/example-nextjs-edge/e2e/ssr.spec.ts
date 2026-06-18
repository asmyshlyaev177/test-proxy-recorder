import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// Talk to the mock backend directly (not through the proxy) to seed each test's
// own data in record mode. In replay mode the backend is untouched — the proxy
// serves each session's recording from disk.
const BACKEND_URL = 'http://localhost:3012';

async function seed(text: string) {
  await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
  await fetch(`${BACKEND_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay');
});

// Each test seeds a DISTINCT todo and asserts the server-rendered page shows
// only its own. Under parallel replay these run as concurrent proxy sessions,
// so the SSR fetch must carry the recording id for the proxy to serve the right
// recording. Without it, the proxy cannot tell the sessions apart and the
// assertions fail.
for (const text of ['alpha-task', 'bravo-task', 'charlie-task', 'delta-task']) {
  test(`SSR renders the ${text} todo from its own recording`, async ({ page }) => {
    if (mode === 'record') {
      await seed(text);
    }

    await page.goto('/');

    const items = page.getByTestId('todo-text');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText(text);
  });
}
