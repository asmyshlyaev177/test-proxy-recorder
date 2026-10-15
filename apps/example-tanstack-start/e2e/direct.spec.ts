import { expect, type Page, type Request, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3002';

// The /direct page calls the API itself, not through the proxy, so these are the
// browser requests the .har serves in replay (the proxy answers its own).
const CLIENT_SIDE_URL = /localhost:3002/;

interface ListRead {
  request: Request;
  body: Promise<unknown>;
}

/** Every GET of the list the browser makes, with what it was answered, in order. */
function watchListReads(page: Page): ListRead[] {
  const reads: ListRead[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (request.method() === 'GET' && request.url() === `${BACKEND_URL}/todos`) {
      reads.push({ request, body: response.json() });
    }
  });
  return reads;
}

async function resetData() {
  await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' }).catch(() => false);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (mode === 'record') {
    await resetData();
  }
  await playwrightProxy.before(page, testInfo, mode, { url: CLIENT_SIDE_URL });
});

// GET, POST, GET on one URL. The two GETs are the same request, so Playwright's
// own HAR replay answered both with the first recording and the added todo
// never showed (microsoft/playwright#18288). Each must get its own recording.
test('answers the read after the write with its own recording', async ({ page }) => {
  const reads = watchListReads(page);
  await page.goto('/direct');
  await expect(page.getByTestId('direct-status')).toHaveText('loaded');

  await page.getByTestId('direct-input').fill('Buy milk');
  await page.getByTestId('direct-add').click();

  await expect.poll(() => reads.length).toBe(2);
  const [before, after] = reads;
  expect(after.request.method()).toBe(before.request.method());
  expect(after.request.url()).toBe(before.request.url());
  expect(after.request.headers()).toEqual(before.request.headers());
  expect(await before.body).toEqual([]);
  expect(await after.body).toEqual([expect.objectContaining({ text: 'Buy milk' })]);

  await expect(page.getByTestId('direct-item')).toHaveText(['Buy milk']);
});
