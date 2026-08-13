/**
 * Lighthouse guardrails for the docs site.
 *
 * The only Playwright suite in this repo that is not about the proxy: the e2e
 * suites under `apps/` drive real applications through record/replay, this one
 * measures the site that documents them. It lives in the landing package
 * because everything it needs is here — the Astro build, the preview server,
 * and a ~100 MB `lighthouse` dependency nothing else has a use for.
 *
 * It audits the **production build**, never `astro dev`. The two differ in most
 * of what is being scored — bundled and minified assets, the prerendered
 * documents, Pagefind's search index, the `_headers` the Cloudflare adapter
 * emits — so a green dev run would say nothing about what is deployed.
 */
import { defineConfig } from '@playwright/test';

/**
 * Deliberately not 4321, which both `astro dev` and `astro preview` default to:
 * a dev server left running would otherwise be silently accepted in place of
 * the build, and dev is the one thing this suite must not measure.
 */
const PREVIEW_PORT = 4331;

/** Exported for the spec, which drives its own browser over CDP and so never
 *  sees `baseURL`. */
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './tests',
  // Serial, one worker. Two Chrome instances auditing at once skew each other's
  // performance numbers — the audit ends up measuring the test runner rather
  // than the site — and there is nothing to gain by racing seven short runs.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A cold Lighthouse run is far slower than an ordinary assertion.
  timeout: 180_000,
  reporter: [['list']],
  // No `use` block: every test launches its own browser (Lighthouse needs a
  // debugging port the `page` fixture does not expose), so nothing here would
  // reach it.

  webServer: {
    command: 'pnpm run build && pnpm run preview:lighthouse',
    url: PREVIEW_URL,
    reuseExistingServer: !process.env.CI,
    // The build renders 405 pages, runs TypeDoc and indexes with Pagefind, and
    // `astro preview` on the Cloudflare adapter boots wrangler on top of that.
    timeout: 300_000,
  },
});
