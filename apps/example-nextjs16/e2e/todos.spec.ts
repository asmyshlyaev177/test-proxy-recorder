import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3002';

// Matches client-side fetch calls from the browser to the proxy (port 8100)
// These are recorded via Playwright's HAR mechanism alongside the server-side .mock.json
const CLIENT_SIDE_URL = /localhost:8100/;

async function resetData() {
  await fetch(`${BACKEND_URL}/todos`, { method: 'DELETE' });
}

test.beforeEach(async ({ page }, testInfo) => {
  await resetData();
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay', { url: CLIENT_SIDE_URL });
});


test('creates a new todo', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-todo-input').fill('Buy groceries');
  await page.getByTestId('add-btn').click();

  await expect(page.getByTestId('todo-text').first()).toHaveText('Buy groceries');

  await page.waitForTimeout(1000);
});

test('filters todos by text', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-todo-input').fill('Buy groceries');
  await page.getByTestId('add-btn').click();
  await page.getByTestId('new-todo-input').fill('Read a book');
  await page.getByTestId('add-btn').click();

  await page.getByTestId('filter-input').fill('buy');

  const items = page.getByTestId('todo-item');
  await expect(items).toHaveCount(1);
  await expect(items.first().getByTestId('todo-text')).toHaveText('Buy groceries');

  await page.waitForTimeout(1000);
});

test('toggles a todo as completed', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-todo-input').fill('Write tests');
  await page.getByTestId('add-btn').click();

  await page.getByTestId('todo-checkbox').first().click();

  await expect(page.getByTestId('todo-text').first()).toHaveClass(/completed/);

  await page.waitForTimeout(1000);
});

test('edits a todo', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-todo-input').fill('Old text');
  await page.getByTestId('add-btn').click();

  await page.getByTestId('edit-btn').first().click();
  await page.getByTestId('edit-input').fill('New text');
  await page.getByTestId('save-btn').click();

  await expect(page.getByTestId('todo-text').first()).toHaveText('New text');

  await page.waitForTimeout(1000);
});

test('deletes a todo', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('new-todo-input').fill('To be deleted');
  await page.getByTestId('add-btn').click();
  await expect(page.getByTestId('todo-item')).toHaveCount(1);

  await page.getByTestId('delete-btn').first().click();

  await expect(page.getByTestId('todo-item')).toHaveCount(0);

  await page.waitForTimeout(1000);
});
