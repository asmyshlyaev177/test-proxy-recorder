import path from 'path';
import os from 'os';
import { rm, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { playwrightProxy } from 'test-proxy-recorder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Built extension is copied here by global-setup before tests run.
export const EXTENSION_PATH =
  process.env.EXTENSION_PATH ?? path.join(__dirname, '..', 'extension');

export const AUTH_FILE = path.join(__dirname, '.auth', 'state.json');

// Matches browser-side fetch calls to X/Twitter APIs.
const CLIENT_SIDE_URL = /x\.com|twimg\.com|abs\.twimg\.com|api\.x\.com/;

// Switch to 'record' to hit the real API and update recordings.
export const MODE: 'record' | 'replay' = process.env.RECORD_MODE ? 'record' : 'replay';

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
        `--disable-extensions-except=${EXTENSION_PATH}`,
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
