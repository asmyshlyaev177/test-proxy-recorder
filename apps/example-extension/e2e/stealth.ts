/**
 * Stealth browser launch for X/Twitter — used by the auth setup step.
 *
 * Uses the locally installed Google Chrome (`channel: 'chrome'`) rather than
 * Playwright's bundled Chromium. Real Chrome already presents a coherent
 * fingerprint — its User-Agent, navigator.platform, WebGL renderer and Client
 * Hints all agree on the real OS — so no spoofing is needed. The previous setup
 * (playwright-extra + StealthPlugin on bundled Chromium) actively forged a
 * Windows User-Agent while the host stayed Linux and WebGL reported a Mac GPU
 * string; that contradiction is exactly what X's bot detection scores against,
 * so adding "stealth" patches made detection worse, not better.
 *
 * The one signal a normal automated launch still leaks is navigator.webdriver;
 * --disable-blink-features=AutomationControlled clears it.
 */
import { chromium, type BrowserContext } from '@playwright/test';

export async function launchStealthContext(userDataDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    locale: 'en-US',
    // Inherit the host's real timezone so it matches the connection's IP —
    // a hardcoded zone that disagrees with the IP geolocation is a bot signal.
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // 1920x1080 is the most common desktop resolution; it also matches this
    // host, keeping screen/window metrics consistent with the real display.
    viewport: null,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      // Extension intentionally NOT loaded here — the auth step only needs to
      // capture cookies/storage. A loaded extension adds detectable signals
      // (content-script injections, chrome.runtime.id checks) that X's login
      // flow probes before letting the username step proceed.
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--password-store=basic',
      '--use-mock-keychain',
      '--lang=en-US,en',
      '--window-size=1920,1080',
    ],
  });
}
