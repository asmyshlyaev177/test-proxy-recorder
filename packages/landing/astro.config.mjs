// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// TODO: Canonical origin — update when the final (custom) domain is decided.
// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.pages.dev',
  integrations: [sitemap()],
});
