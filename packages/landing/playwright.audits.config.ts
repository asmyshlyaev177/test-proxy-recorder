/**
 * The docs site's rendered-output gates: accessibility, then Lighthouse.
 *
 * The only Playwright suites in this repo that are not about the proxy: the
 * e2e suites under `apps/` drive real applications through record/replay,
 * these measure the site that documents them. They live in the landing package
 * because everything they need is here — the Astro build, the preview server,
 * and a ~100 MB `lighthouse` dependency nothing else has a use for.
 *
 * Both audit the **production build**, never `astro dev`. The two differ in
 * most of what is being scored — bundled and minified assets, the prerendered
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

/** Exported for the specs, which drive their own browser over CDP and so
 *  never see `baseURL`. */
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  // A cold Lighthouse run is far slower than an ordinary assertion.
  timeout: 180_000,
  reporter: [['list']],
  // No `use` block: the Lighthouse tests launch their own browser (Lighthouse
  // needs a debugging port the `page` fixture does not expose), so nothing here
  // would reach them; the a11y suite is happy with the defaults.

  projects: [
    { name: 'a11y', testMatch: /a11y\.spec\.ts/ },
    // Held back so the audits have the box to themselves: two Chrome instances
    // auditing at once skew each other's performance numbers, and the audit
    // ends up measuring the test runner rather than the site. `workers` stays
    // at the default because the spec's serial describe pins them to one anyway.
    {
      name: 'lighthouse',
      testMatch: /lighthouse\.spec\.ts/,
      dependencies: ['a11y'],
    },
  ],

  webServer: {
    command: 'pnpm run build && pnpm run preview:lighthouse',
    url: PREVIEW_URL,
    reuseExistingServer: !process.env.CI,
    // The build renders 405 pages, runs TypeDoc and indexes with Pagefind, and
    // `astro preview` on the Cloudflare adapter boots wrangler on top of that.
    timeout: 300_000,
  },
});
