// @ts-check
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Adapter is declared explicitly (instead of relying on Cloudflare's build-time
// auto-config) so the version is pinned in the lockfile and the build is
// reproducible. The site is static; the adapter packages it for Cloudflare.
// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.dev',
  adapter: cloudflare(),
  integrations: [sitemap()],
});
