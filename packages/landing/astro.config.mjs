// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.dev',
  integrations: [sitemap()],
});
