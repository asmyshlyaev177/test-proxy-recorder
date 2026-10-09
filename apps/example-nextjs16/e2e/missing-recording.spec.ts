import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Always replay a session that was never recorded: the page's SSR fetch has no
// recording, and the test must fail on that at once with the proxy's reason,
// not on a locator timeout.
test('a request with no recording fails the test at once', async ({
  page,
}, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay');
  const startedAt = Date.now();

  const error = await page
    .goto('/')
    .then(() => page.getByTestId('todo-text').first().waitFor({ timeout: 20_000 }))
    .then(
      () => null,
      (error_: Error) => error_,
    );

  expect(error?.message).toContain('No recording for GET');
  expect(Date.now() - startedAt).toBeLessThan(10_000);
});
