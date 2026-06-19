import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Guards the SSR recording-id forwarding: the home page is server-rendered from a
// fetch through the proxy (app/page.tsx), tagged by registerProxyFetch() in
// app/layout.tsx. Each test seeds a DISTINCT todo and asserts the server-rendered
// page shows only its own. Under parallel replay these run as concurrent proxy
// sessions, so the SSR fetch MUST carry the recording id — without it (e.g. with
// only the proxy.ts middleware, or no helper at all) the proxy can't tell the
// sessions apart and these assertions fail. See repo TODO.md for the experiment.
const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// Seed directly against the mock backend (not through the proxy), only in record
// mode where the backend is up. In replay the proxy serves each session's
// recording from disk.
const BACKEND_URL = 'http://localhost:3002';

async function seed(text: string) {
  await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
  await fetch(`${BACKEND_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  // No `url` — this is pure SSR (no browser-side fetch to intercept via HAR).
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay');
});

for (const name of ['alpha', 'bravo', 'charlie', 'delta']) {
  const text = `SSR-ONLY-${name}`;
  test(`SSR renders the ${name} todo from its own recording`, async ({
    page,
  }) => {
    if (mode === 'record') {
      await seed(text);
    }

    await page.goto('/');

    const items = page.getByTestId('todo-text');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText(text);
  });
}
