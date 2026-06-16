import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// Browser fetches go to the proxy (port 8100); recorded via the HAR mechanism.
const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode, { url: CLIENT_SIDE_URL });
});

// A normal browser test: it renders a page whose client-side fetch carries an
// Authorization header and receives a secret in the response. The redaction of
// the resulting .har/.mock.json is asserted separately (see assert-redactions.mjs),
// because the .har is only flushed and scrubbed after the test's context closes.
test('loads the secret page', async ({ page }) => {
  await page.goto('/secret');

  await expect(page.getByTestId('secret-status')).toHaveText('loaded');
  await expect(page.getByTestId('secret-message')).toHaveText('Secret loaded');
});
