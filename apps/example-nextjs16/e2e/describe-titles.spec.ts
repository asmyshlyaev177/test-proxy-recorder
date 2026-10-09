import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Two describe blocks hold a test with the same title and different data. The
// session id includes the describe title, so each block replays its own
// recording; when it did not, the second recording overwrote the first.
const mode = process.env.RECORD_MODE ? 'record' : 'replay';
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
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay');
});

for (const name of ['alpha', 'bravo']) {
  test.describe(`${name} block`, () => {
    test('SSR renders the todo seeded for this block', async ({ page }) => {
      const text = `DESCRIBE-${name}`;
      if (mode === 'record') {
        await seed(text);
      }

      await page.goto('/');

      await expect(page.getByTestId('todo-text')).toHaveText([text]);
    });
  });
}
