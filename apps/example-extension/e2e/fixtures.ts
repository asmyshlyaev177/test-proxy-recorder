/**
 * Test fixtures for the extension example.
 *
 * `context`     — a persistent Chromium context with the extension loaded and
 *                 the saved X session restored.
 * `extensionId` — the loaded extension's runtime id.
 * `page`        — a page wired to test-proxy-recorder, so browser-side requests
 *                 matching CLIENT_SIDE_URL are recorded (record mode) or served
 *                 from the recorded HAR (replay mode).
 *
 * Set RECORD_MODE to hit the real API and (re)write recordings; otherwise
 * everything replays from disk.
 */
import path from 'path';
import os from 'os';
import { rm, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { playwrightProxy } from 'test-proxy-recorder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built extension lives in ../extension (checked into the repo). Point
// EXTENSION_PATH at your own build to test a different extension.
export const EXTENSION_PATH =
  process.env.EXTENSION_PATH ?? path.join(__dirname, '..', 'extension');

export const AUTH_FILE = path.join(__dirname, '.auth', 'state.json');

// Browser-side requests whose URL matches this are recorded/replayed. Change it
// to your own API hosts when adapting this example.
const CLIENT_SIDE_URL = /x\.com|twimg\.com|abs\.twimg\.com|api\.x\.com/;

// 'record' hits the real API and updates the HAR; 'replay' serves from disk.
export const MODE: 'record' | 'replay' = process.env.RECORD_MODE ? 'record' : 'replay';

// The test context uses Playwright's bundled Chromium (+ stealth) rather than
// real Chrome like the auth step, because it must load an unpacked extension
// via --load-extension, which recent Chrome stable restricts. Stealth matters
// here only in record mode, when these pages hit the live API.
chromium.use(StealthPlugin());

type StorageState = {
  cookies: Parameters<BrowserContext['addCookies']>[0];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
};

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  page: Page;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const userDataDir = path.join(os.tmpdir(), `pw-ext-${Date.now()}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        // `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    }) as unknown as BrowserContext;

    const state = await readFile(AUTH_FILE, 'utf-8')
      .then(JSON.parse as (s: string) => StorageState)
      .catch(() => null);

    if (state) {
      await context.addCookies(state.cookies);
      for (const { origin, localStorage: items } of state.origins) {
        await context.addInitScript(
          ({ o, entries }) => {
            if (location.origin === o) {
              for (const { name, value } of entries) localStorage.setItem(name, value);
            }
          },
          { o: origin, entries: items },
        );
      }
    }

    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForLoadState('domcontentloaded');
    const extensionId = await extPage.evaluate(() => {
      const manager = document.querySelector('extensions-manager') as any;
      const itemList = manager?.shadowRoot?.querySelector('extensions-item-list') as any;
      const item = itemList?.shadowRoot?.querySelector('extensions-item') as Element | null;
      return item?.getAttribute('id') ?? null;
    });
    await extPage.close();
    if (!extensionId) throw new Error('Extension not found on chrome://extensions/');
    await use(extensionId);
  },

  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});

export { expect };
