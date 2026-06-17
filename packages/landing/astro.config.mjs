// @ts-check
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig, sessionDrivers } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

const repo = 'https://github.com/asmyshlyaev177/test-proxy-recorder';

// Adapter is declared explicitly (instead of relying on Cloudflare's build-time
// auto-config) so the version is pinned in the lockfile and the build is
// reproducible. The site is static; the adapter packages it for Cloudflare.
// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.dev',
  adapter: cloudflare(),
  integrations: [
    sitemap(),
    // Docs site. The hand-built marketing page owns `/` (src/pages/index.astro);
    // Starlight owns everything under `/docs/`, so docs content lives in the
    // nested `src/content/docs/docs/` directory (Starlight's documented way to
    // serve from a subpath). Docs are the source of truth — the README links
    // here rather than duplicating content.
    starlight({
      title: 'test-proxy-recorder',
      description:
        'VCR for Playwright — record real API responses once, replay them deterministically on CI. SSR proxy, browser HAR, and WebSockets.',
      logo: { src: './public/favicon.svg', alt: 'test-proxy-recorder' },
      // English is the source locale (served unprefixed); translations live
      // under src/content/docs/<lang>/docs/. Starlight localizes the sidebar
      // slugs automatically and falls back to English for any untranslated
      // page (e.g. the generated API reference, which stays English).
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
        fr: { label: 'Français', lang: 'fr' },
        ja: { label: '日本語', lang: 'ja' },
        'zh-cn': { label: '简体中文', lang: 'zh-CN' },
        ru: { label: 'Русский', lang: 'ru' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: repo },
        { icon: 'discord', label: 'Discord (support)', href: 'https://discord.gg/w7rgYbY5zz' },
      ],
      editLink: { baseUrl: `${repo}/edit/master/packages/landing/` },
      customCss: ['./src/styles/docs.css'],
      plugins: [
        // Generate the API reference from the package's TypeScript + JSDoc, so
        // it can't drift from the actual exported signatures. Output lands in
        // src/content/docs/docs/reference/api/ (gitignored, regenerated each
        // build); `typeDocSidebarGroup` slots it into the Reference group below.
        starlightTypeDoc({
          entryPoints: ['../test-proxy-recorder/src/index.ts'],
          tsconfig: '../test-proxy-recorder/tsconfig.json',
          output: 'docs/reference/api',
          sidebar: { label: 'API reference', collapsed: true },
          typeDoc: {
            // index.ts is a re-export barrel; keep the page focused.
            excludeExternals: true,
          },
        }),
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Quick start', slug: 'docs/getting-started/quick-start' },
            { label: 'Manual setup', slug: 'docs/getting-started/manual-setup' },
            { label: 'How it works', slug: 'docs/getting-started/how-it-works' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'CLI', slug: 'docs/guides/cli' },
            { label: 'Config file', slug: 'docs/guides/config' },
            { label: 'Secret redaction', slug: 'docs/guides/secret-redaction' },
            { label: 'Control endpoint', slug: 'docs/guides/control-endpoint' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'Playwright', slug: 'docs/integrations/playwright' },
            { label: 'Next.js', slug: 'docs/integrations/nextjs' },
            { label: 'TanStack Start', slug: 'docs/integrations/tanstack-start', badge: 'Soon' },
            { label: 'React Router / Remix', slug: 'docs/integrations/react-router', badge: 'Soon' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Example apps', slug: 'docs/reference/examples' },
            typeDocSidebarGroup,
            { label: 'AI agent skills', slug: 'docs/reference/ai-agent-skills' },
            { label: 'FAQ', slug: 'docs/reference/faq' },
          ],
        },
      ],
    }),
  ],
  // This is a fully static site, so sessions never run. Left to its default,
  // the Cloudflare adapter auto-enables KV-backed sessions and injects a
  // `SESSION` kv_namespaces binding with no id, which makes `wrangler deploy`
  // try to *create* the namespace on every deploy — and fail once it exists
  // ("namespace ... already exists [code: 10014]"). Pinning a non-KV session
  // driver opts out of that binding entirely. lruCache is an in-memory, pure-JS
  // driver (no `node:fs`), so it bundles cleanly into the workerd prerender step.
  session: { driver: sessionDrivers.lruCache() },
});
