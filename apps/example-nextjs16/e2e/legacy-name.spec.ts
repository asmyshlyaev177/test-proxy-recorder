import { copyFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// A recording saved before describe titles were part of the session id, so it
// has the old name. Recordings are gitignored here, so the committed copy is put
// in place first; the test always replays so the record pass never rewrites it.
const LEGACY_FILE =
  'legacy-name__replays-a-recording-saved-under-the-old-name.mock.json';

test.beforeAll(async () => {
  await copyFile(
    path.resolve('e2e/legacy-recordings', LEGACY_FILE),
    path.resolve('e2e/recordings', LEGACY_FILE),
  );
});

test.describe('a describe block', () => {
  test('replays a recording saved under the old name', async ({
    page,
  }, testInfo) => {
    await playwrightProxy.before(page, testInfo, 'replay');

    await page.goto('/');

    await expect(page.getByTestId('todo-text')).toHaveText(['SSR-ONLY-alpha']);
  });
});
