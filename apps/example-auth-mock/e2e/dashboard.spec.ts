import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// These specs start ALREADY authenticated: the `setup` project saved a
// storageState (token + cookie) that playwright.config.ts loads for this
// project. Each protected request the page makes carries the Bearer token and
// session cookie — both are redacted from the recordings.

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
// Browser fetches go to the proxy (port 8100); recorded via the HAR mechanism.
const CLIENT_SIDE_URL = /localhost:8100/;
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3102';

async function resetData() {
  // Reset directly against the backend (not through the proxy). Only needed when
  // recording; replay doesn't touch the backend.
  await fetch(`${BACKEND_URL}/protected/todos`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer reset' },
  }).catch(() => false);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (mode === 'record') {
    await resetData();
  }
  await playwrightProxy.before(page, testInfo, mode, { url: CLIENT_SIDE_URL });
});

test('loads the protected dashboard when authenticated', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page.getByTestId('dashboard-status')).toContainText('Signed in');
  await expect(page.getByTestId('new-todo-input')).toBeVisible();
});

test('creates a protected todo', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByTestId('new-todo-input').fill('Protected task');
  await page.getByTestId('add-btn').click();

  await expect(page.getByTestId('todo-text').first()).toHaveText('Protected task');
});

test('deletes a protected todo', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByTestId('new-todo-input').fill('To be deleted');
  await page.getByTestId('add-btn').click();
  await expect(page.getByTestId('todo-item')).toHaveCount(1);

  await page.getByTestId('delete-btn').first().click();

  await expect(page.getByTestId('todo-item')).toHaveCount(0);
});
