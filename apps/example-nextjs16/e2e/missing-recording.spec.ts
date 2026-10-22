import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Both tests always replay, so the record pass never records them.
const EMPTY_SESSION_ID =
  'missing-recording__a-request-with-no-recording-fails-the-test-at-once';

// The second test has a recording with no requests in it; recordings are
// gitignored here, so it is written in place first.
test.beforeAll(async () => {
  await writeFile(
    path.resolve('e2e/recordings', `${EMPTY_SESSION_ID}.mock.json`),
    JSON.stringify({ id: EMPTY_SESSION_ID, recordings: [], websocketRecordings: [] }),
  );
});

// Never recorded: replay refuses to start rather than letting the test fail
// later on a bare 404, or pass having checked nothing.
test('a test with no recording fails before replay starts', async ({
  page,
}, testInfo) => {
  await expect(
    playwrightProxy.before(page, testInfo, 'replay'),
  ).rejects.toThrow('This test has no recording');
});

// The page's SSR fetch has no recording, and the test must fail on that at once
// with the proxy's reason, not on a locator timeout.
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
