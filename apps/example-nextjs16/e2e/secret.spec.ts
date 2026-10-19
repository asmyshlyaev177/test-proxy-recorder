import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

import { PROXY_URL_PATTERN } from './ports';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode, { url: PROXY_URL_PATTERN });
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
