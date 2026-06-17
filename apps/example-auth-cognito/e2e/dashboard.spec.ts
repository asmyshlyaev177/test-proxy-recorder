import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// These specs start ALREADY authenticated: the `setup` project logged in to
// Cognito and saved a storageState (the access token in localStorage) that
// playwright.config.ts loads for this project. Each protected request carries the
// Cognito JWT as a Bearer header — the recorder redacts it from the recordings.

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
// Browser fetches go to the proxy (port 8100); recorded via the HAR mechanism.
const CLIENT_SIDE_URL = /localhost:8100/;
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3202';

async function resetData() {
  // Reset directly against the backend (not through the proxy). Only runs in
  // record mode, where the backend is up — so fail fast if it doesn't succeed,
  // rather than recording against stale data.
  const res = await fetch(`${BACKEND_URL}/protected/todos`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer reset' },
  });
  if (!res.ok) {
    throw new Error(`Failed to reset protected todos: ${res.status}`);
  }
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
