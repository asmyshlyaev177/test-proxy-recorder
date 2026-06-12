/**
 * Auth setup — runs once before the test suite in record mode.
 * If e2e/.auth/state.json exists, its session is verified against x.com first;
 * an expired session is discarded and the login flow runs again.
 * Otherwise opens x.com/login — log in manually in the browser and the script
 * continues automatically once you reach the home page.
 *
 * Skipped entirely in replay mode — the recorded HAR contains the full session.
 */
import path from 'path';
import os from 'os';
import { mkdir, readFile, rm } from 'fs/promises';
import { test as setup, type BrowserContext, type Page } from '@playwright/test';
import { AUTH_FILE, MODE } from './fixtures';
import { launchStealthContext } from './stealth';

type StorageState = {
  cookies: Parameters<BrowserContext['addCookies']>[0];
};

setup('authenticate with X', async () => {
  if (MODE === 'replay') return;

  // The global 60 s test timeout would kill the manual login wait below —
  // give this step enough room for the session check plus a 2 min login.
  setup.setTimeout(3 * 60 * 1000);

  // Saved session, if any. Its validity is checked against x.com below —
  // existence of the file alone is not enough, the session may have expired.
  const state = await readFile(AUTH_FILE, 'utf-8')
    .then(JSON.parse as (s: string) => StorageState)
    .catch(() => null);

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });

  const userDataDir = path.join(os.tmpdir(), `pw-auth-${Date.now()}`);
  const context = await launchStealthContext(userDataDir);

  if (state) await context.addCookies(state.cookies);

  const page = await context.newPage();
  // Land on the main page first so X's analytics/session scripts can run
  // before the login flow starts — going straight to /i/flow/login on a
  // cold session raises the bot-score and can freeze the username step.
  // networkidle needs an explicit timeout: x.com polls its APIs continuously
  // (always on the logged-in timeline), so the network may never go idle and
  // the default action timeout is unlimited — without it the setup hangs here.
  await page.goto('https://x.com');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  if (state) {
    if (await isLoggedIn(page)) {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
      return;
    }

    console.log('\n[auth] Saved session is expired — removing state file and logging in again.\n');
    await rm(AUTH_FILE, { force: true });
    // Drop the stale cookies so the login flow starts from a clean session.
    await context.clearCookies();
    await page.goto('https://x.com');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  await page.goto('https://x.com/i/flow/login');

  // Intentionally NOT using page.pause() here. page.pause() opens the
  // Playwright Inspector by injecting a CDP debug session into the page
  // context, which X's login JS detects and uses to stall the username step.
  // Instead we just wait for the URL to reach home — the user logs in
  // normally in the visible browser window.
  console.log('\n[auth] Log in to X in the browser window. The script will continue automatically once you reach the home page (2 min timeout).\n');
  await page.waitForURL(/x\.com\/(home|$)/, { timeout: 2 * 60 * 1000 }).catch(async () => {
    const url = page.url();
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    throw new Error(`Login did not complete — expected redirect to x.com/home or x.com/, got: ${url}`);
  });

  await context.storageState({ path: AUTH_FILE });
  await context.close();
  await rm(userDataDir, { recursive: true, force: true });
});


/**
 * Decide whether the current page shows a logged-in X session. The URL is not
 * a reliable signal — x.com keeps the URL on / for the logged-out landing and
 * can take a while to settle on /home with a live one. Check the rendered UI
 * instead: the account switcher in the left nav only exists for a logged-in
 * session, while the logged-out landing renders the third-party sign-in
 * buttons (its only stable data-testid — the old "loginButton" is gone).
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  const accountSwitcher = page.getByTestId('SideNav_AccountSwitcher_Button');
  const loggedOutLanding = page.getByTestId('google_sign_in_container');
  // 'attached', not 'visible' — the sign-in container is a zero-size wrapper
  // around Google's iframe and never counts as visible.
  await accountSwitcher
    .or(loggedOutLanding)
    .first()
    .waitFor({ state: 'attached', timeout: 20_000 })
    .catch(() => { });
  return accountSwitcher.isVisible();
}
