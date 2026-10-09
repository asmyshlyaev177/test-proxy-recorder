import { access, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Test titles with characters Windows forbids in file names. Recordings are
// saved under a sanitized name; replay falls back to the name earlier versions
// used, which kept those characters in `.har` names.

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3002';
// Browser calls to the proxy, recorded to the HAR.
const CLIENT_SIDE_URL = /localhost:8100/;
const RECORDINGS_DIR = path.resolve('e2e/recordings');

const exists = (fileName: string) =>
  access(path.join(RECORDINGS_DIR, fileName)).then(
    () => true,
    () => false,
  );

test.describe('new name', () => {
  test('adds a todo: "new" name?', async ({ page }, testInfo) => {
    if (mode === 'record') {
      await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
    }
    await playwrightProxy.before(page, testInfo, mode, { url: CLIENT_SIDE_URL });

    await page.goto('/');
    await page.getByTestId('new-todo-input').fill('Named safely');
    await page.getByTestId('add-btn').click();

    await expect(page.getByTestId('todo-text').first()).toHaveText(
      'Named safely',
    );
    // A record run writes its files when the page closes, after this test.
    if (mode === 'replay') {
      const base = 'file-names__new-name__adds-a-todo_-_new_-name_';
      expect(await exists(`${base}.har`)).toBe(true);
      expect(await exists(`${base}.mock.json`)).toBe(true);
      expect(await exists('file-names__new-name__adds-a-todo:-"new"-name?.har')).toBe(false);
    }
  });
});

test.describe('Корзина', () => {
  // A non-ASCII describe title travels in the session-id header as UTF-8.
  test('adds a todo', async ({ page }, testInfo) => {
    if (mode === 'record') {
      await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
    }
    await playwrightProxy.before(page, testInfo, mode, { url: CLIENT_SIDE_URL });

    await page.goto('/');
    await page.getByTestId('new-todo-input').fill('Named in Cyrillic');
    await page.getByTestId('add-btn').click();

    await expect(page.getByTestId('todo-text').first()).toHaveText(
      'Named in Cyrillic',
    );
    if (mode === 'replay') {
      expect(await exists('file-names__корзина__adds-a-todo.mock.json')).toBe(true);
    }
  });
});

// No describe block, so earlier versions gave this test the same session id
// and saved its HAR as OLD_HAR; the `.mock.json` name is the same under both
// rules. Recordings are gitignored here, so the committed copies are put in
// place first; the test always replays so the record pass never rewrites them.
const OLD_BASE = 'file-names__adds-a-todo_-_old_-name_';
const OLD_HAR = 'file-names__adds-a-todo:-"old"-name?.har';

test('adds a todo: "old" name?', async ({ page }, testInfo) => {
  // Windows can't hold a file named with `:` or `?`, so the old name never
  // existed there.
  test.skip(process.platform === 'win32', 'old name is not valid on Windows');
  const fixtures = path.resolve('e2e/legacy-recordings');
  await rm(path.join(RECORDINGS_DIR, `${OLD_BASE}.har`), { force: true });
  await copyFile(
    path.join(fixtures, 'old-har-name.har'),
    path.join(RECORDINGS_DIR, OLD_HAR),
  );
  await copyFile(
    path.join(fixtures, 'old-har-name.mock.json'),
    path.join(RECORDINGS_DIR, `${OLD_BASE}.mock.json`),
  );

  await playwrightProxy.before(page, testInfo, 'replay', {
    url: CLIENT_SIDE_URL,
  });

  await page.goto('/');
  await page.getByTestId('new-todo-input').fill('Named the old way');
  await page.getByTestId('add-btn').click();

  await expect(page.getByTestId('todo-text').first()).toHaveText(
    'Named the old way',
  );
  expect(await exists(`${OLD_BASE}.har`)).toBe(false);
});
