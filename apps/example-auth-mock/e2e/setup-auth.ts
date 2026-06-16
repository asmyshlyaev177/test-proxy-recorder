import { test as setupAuth } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

import { authStatePath } from './auth-state-path';

// Logs in ONCE before the real specs. The proxy is put into `transparent` mode
// for this step, so the login request (credentials + the issued token) is passed
// straight through to the backend and NEVER recorded. The resulting session —
// both the localStorage token and the httpOnly cookie — is saved to a gitignored
// storageState that the authenticated specs reuse.
//
// This is the per-provider seam: a real provider (Cognito/Clerk/…) swaps the body
// of this function for its own login (UI flow or a programmatic token grant),
// then saves storageState the same way.
setupAuth('authenticate', async ({ page }) => {
  await setProxyMode('transparent');

  await page.goto('/login');

  await page.getByTestId('email').fill('test@example.com');
  await page.getByTestId('password').fill('Password123');
  await page.getByTestId('signinButton').click();

  await page.waitForURL('/dashboard', { timeout: 15_000 });
  // Make sure the protected data finished loading before snapshotting state
  // (the add-todo input only renders once the initial fetch resolves).
  await page.getByTestId('new-todo-input').waitFor({ state: 'visible' });

  await page.context().storageState({ path: authStatePath });
});
