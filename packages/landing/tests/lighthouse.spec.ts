/**
 * Lighthouse audits against the production build.
 *
 * Performance is the one number here that isn't deterministic — it is a timing
 * measurement on whatever machine runs it. It holds at 100 because every page
 * is prerendered HTML. If a future change makes it flaky, lower *that*
 * threshold rather than deleting the assertion; the real performance signal is
 * field data and PageSpeed Insights against production. The other three are
 * deterministic audits of the document, and a drop in any of them is a
 * regression rather than noise.
 */
import { chromium, test } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

import { PREVIEW_URL } from '../playwright.lighthouse.config';

/**
 * One page per template, not one page per route.
 *
 * The build emits **265** documents — 44 docs pages across six locales, plus
 * the marketing page and the 404 — and auditing all of them would spend twenty
 * minutes re-measuring the same three layouts. Starlight renders every docs
 * page from one template, so the useful question is not "which pages" but
 * "which shapes of page": each entry below covers a shape the others don't,
 * and a page that is only a different *instance* of an existing shape adds
 * runtime and no signal.
 *
 * Add an entry when a genuinely new template lands — a new layout, a new
 * component on a page type, a generator emitting a structure TypeDoc doesn't.
 */
const PAGES = [
  { path: '/', name: '/ (marketing page, video hero)' },
  { path: '/docs/', name: '/docs/ (Starlight index)' },
  {
    path: '/docs/getting-started/quick-start/',
    name: 'guide (prose + snippets)',
  },
  { path: '/docs/guides/config/', name: 'guide (expressive-code blocks)' },
  {
    path: '/docs/reference/api/classes/proxyserver/',
    name: 'API reference (TypeDoc-generated)',
  },
  // CJK: a different font stack and different text metrics from the Latin
  // locales, which is the only reason one locale is not enough. Japanese
  // stands in for es/fr/ru/zh-cn, all of which render from this same template.
  { path: '/ja/docs/', name: '/ja/docs/ (localised, CJK)' },
  { path: '/404', name: '/404' },
];

const THRESHOLDS = {
  performance: 100,
  accessibility: 100,
  'best-practices': 100,
  seo: 100,
};

test.describe('Lighthouse', () => {
  // Serial: two Chrome instances auditing at once skew each other's
  // performance numbers, and there is nothing to gain by racing seven runs.
  test.describe.configure({ mode: 'serial' });

  for (const { path, name } of PAGES) {
    // No fixture parameter: this test drives its own browser, and Playwright
    // rejects a named first argument ("First argument must use the object
    // destructuring pattern"), leaving `{}` as the only spelling — which is
    // itself a lint error. `test.info()` is the way out of both.
    test(`${name} meets Lighthouse thresholds`, async () => {
      // Lighthouse drives the browser over CDP, which needs a debugging port
      // Playwright's own `page` fixture does not expose. Offset by worker index
      // so a future parallel run cannot collide on it.
      const port = 9333 + test.info().workerIndex;
      const browser = await chromium.launch({
        args: [`--remote-debugging-port=${port}`],
      });

      try {
        const page = await browser.newPage();
        await page.goto(`${PREVIEW_URL}${path}`, { waitUntil: 'networkidle' });

        await playAudit({
          page,
          port,
          thresholds: THRESHOLDS,
          // Desktop, not Lighthouse's mobile default: mobile applies a 4x CPU
          // slowdown, which turns the performance score into a measurement of
          // the runner rather than the site.
          config: desktopConfig,
          disableLogs: false,
        });
      } finally {
        await browser.close();
      }
    });
  }
});
