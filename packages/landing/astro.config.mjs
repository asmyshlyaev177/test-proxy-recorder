// @ts-check
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { defineConfig, sessionDrivers } from 'astro/config';

// Adapter is declared explicitly (instead of relying on Cloudflare's build-time
// auto-config) so the version is pinned in the lockfile and the build is
// reproducible. The site is static; the adapter packages it for Cloudflare.
// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.dev',
  adapter: cloudflare(),
  integrations: [sitemap()],
  // This is a fully static site, so sessions never run. Left to its default,
  // the Cloudflare adapter auto-enables KV-backed sessions and injects a
  // `SESSION` kv_namespaces binding with no id, which makes `wrangler deploy`
  // try to *create* the namespace on every deploy — and fail once it exists
  // ("namespace ... already exists [code: 10014]"). Pinning a non-KV session
  // driver opts out of that binding entirely. lruCache is an in-memory, pure-JS
  // driver (no `node:fs`), so it bundles cleanly into the workerd prerender step.
  session: { driver: sessionDrivers.lruCache() },
});
