/**
 * Example: browser-side HAR recording with a Chrome extension.
 *
 * The proxy records all x.com API traffic to ./recordings/ on first run,
 * then replays from disk on every subsequent run — no network needed.
 *
 * Record once:  RECORD_MODE=1 pnpm test:e2e:record
 * Replay:       pnpm test:e2e
 */
import { test, expect } from './fixtures';

test('accurate location matches About page', async ({ page }) => {
  await page.goto('https://x.com/sotaproject');

  // Hover the user's own tweet to trigger the extension's AboutAccountQuery.
  const usernameLink = page
    .locator('article[data-testid="tweet"] [data-testid="User-Name"] a[href="/sotaproject" i]')
    .first();
  await usernameLink.waitFor({ timeout: 15_000 });

  const queryDone = page.waitForResponse(/AboutAccountQuery/, { timeout: 15_000 });
  await usernameLink.hover();
  await queryDone;

  // Extension renders location info inside the hover card.
  const card = page.locator('[data-testid="HoverCard"]');
  await card.locator('.x-loc-info').waitFor({ timeout: 10_000 });

  const fromCard = await card.evaluate((el) => {
    const flag = el.querySelector<HTMLElement>('.x-loc-icon.x-loc-icon-flag');
    const storeBlock = el.querySelector<HTMLElement>('.x-loc-store-block');
    const basedIn = flag?.title ?? null;
    const storeSource = storeBlock?.title ?? null;
    const m = storeSource?.match(/^(.+?)\s+(?:android\s+app|app\s+store)$/i);
    return { basedIn, appStoreCountry: m?.[1]?.trim() ?? null };
  });

  await expect(fromCard).toEqual({ "appStoreCountry": "Poland", "basedIn": "Lithuania",
})
});
