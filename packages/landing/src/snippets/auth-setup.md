```ts
// e2e/auth.setup.ts — log in for real, once. Never recorded.
import { test as setup } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

setup('authenticate', async ({ page }) => {
  await setProxyMode('transparent');     // login bypasses the recorder
  await page.goto('/login');
  await page.getByTestId('email').fill(process.env.TEST_EMAIL!);
  await page.getByTestId('password').fill(process.env.TEST_PASSWORD!);
  await page.getByTestId('signinButton').click();
  await page.waitForURL('/dashboard');

  // Reused by every test — they start already signed in.
  await page.context().storageState({ path: 'e2e/.auth/state.json' });
});
```
