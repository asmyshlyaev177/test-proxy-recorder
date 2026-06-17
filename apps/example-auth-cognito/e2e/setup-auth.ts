import { test as setupAuth } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

import { authStatePath } from './auth-state-path';

// Credentials for the Cognito test user. Provided via env (CI secrets); see README.
const EMAIL = process.env.COGNITO_TEST_EMAIL;
const PASSWORD = process.env.COGNITO_TEST_PASSWORD;

// Logs in ONCE before the real specs. The proxy is put into `transparent` mode so
// nothing the login does is recorded; the Cognito call itself also goes to a
// different host than the proxy, so it never touches a recording either way. The
// resulting session (the access token in localStorage) is saved to a gitignored
// storageState that the authenticated specs reuse.
//
// This is the per-provider seam: swap this body for another provider's login.
setupAuth('authenticate', async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Set COGNITO_TEST_EMAIL and COGNITO_TEST_PASSWORD (see README) to run the Cognito e2e.',
    );
  }

  await setProxyMode('transparent');

  await page.goto('/login');

  await page.getByTestId('email').fill(EMAIL);
  await page.getByTestId('password').fill(PASSWORD);
  await page.getByTestId('signinButton').click();

  await page.waitForURL('/dashboard', { timeout: 20_000 });
  // The access token is written to localStorage *before* the redirect, so confirm
  // it's there and snapshot. We deliberately DON'T wait for the protected data to
  // load — that request runs in transparent mode and would hang if the backend is
  // down, which is exactly the case for the backend-less replay stack
  // (`pnpm test:e2e:replay`). storageState only needs the token, not the data.
  await page.waitForFunction(
    () => !!window.localStorage.getItem('auth-token'),
    undefined,
    { timeout: 5_000 },
  );

  await page.context().storageState({ path: authStatePath });
});
