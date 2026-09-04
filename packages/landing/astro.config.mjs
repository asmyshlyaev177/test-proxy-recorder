// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig, sessionDrivers } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

import { createLastmodResolver, getContentLastModified } from './scripts/build-date.mjs';
import {
  liftThemeContrast,
  preTabIndex,
  rehypeScrollableTables,
} from './integrations/expressive-code-a11y.mjs';
import { LOCALES } from '../../scripts/i18n/locales.mjs';

// URL prefixes of the translations kept out of the index (`indexed: false`).
const unindexedPrefixes = LOCALES.filter((l) => !l.indexed).map((l) => `/${l.dir}/`);
import { badge as sidebarBadge, label as sidebarLabel } from './src/i18n/sidebar';

const repo = 'https://github.com/asmyshlyaev177/test-proxy-recorder';

// The locale set is declared once, in scripts/i18n/locales.mjs, and expanded
// here into the three shapes that need it. They used to be three hand-kept
// lists, and the third was already wrong: /llms-full.txt enumerated five
// locale prefixes to skip, so a sixth language would have been concatenated
// onto the English docs with nothing to notice.
//
// `dir` is the content directory and URL prefix (lowercase, because content
// collection ids and URLs are); `code` is the BCP 47 tag that goes in
// <html lang> and hreflang. They differ only for zh-CN and pt-BR.
const localeDirs = LOCALES.map((l) => l.dir);

// Starlight: English is the unprefixed root locale, each translation a
// directory under it.
const starlightLocales = {
  root: { label: 'English', lang: 'en' },
  ...Object.fromEntries(LOCALES.map((l) => [l.dir, { label: l.label, lang: l.code }])),
};

// @astrojs/sitemap: maps the URL prefix to the hreflang value it emits. A
// first segment that is not a known locale falls through to `defaultLocale`,
// which is how the unprefixed English pages get theirs.
const sitemapLocales = {
  en: 'en',
  ...Object.fromEntries(LOCALES.map((l) => [l.dir, l.code])),
};

// When the content last changed (HEAD commit). Baked in at build time and
// exposed as __CONTENT_LAST_MODIFIED__ so schema.org `dateModified`, the
// visible "Updated" line, and the /llms.txt header all agree and stay fixed
// for the life of a deploy.
const contentLastModified = getContentLastModified();

// Per-URL <lastmod> for the sitemap, from each page's own newest commit.
const lastmodFor = createLastmodResolver();

/**
 * Support `## Heading {#custom-id}` syntax in markdown. Astro/Starlight don't
 * handle the `{#id}` attribute out of the box: without this the literal
 * `{#id}` text is slugified into the anchor (e.g. `authenticated-app` becomes
 * `authenticated-app-authenticated-app`) and rendered verbatim in the heading,
 * which breaks every cross-link that targets the intended id. This strips the
 * marker from the rendered text and pins it as the heading's id; Starlight's
 * rehype-slug then sees an explicit id and leaves it alone. Headings are always
 * top-level mdast nodes and the marker is plain text at the end, so a shallow
 * walk avoids pulling in unist-util-visit.
 */
function remarkCustomHeadingIds() {
  /** @param {{ children: any[] }} tree */
  return (tree) => {
    for (const node of tree.children) {
      if (node.type !== 'heading' || node.children.length === 0) continue;
      const last = node.children[node.children.length - 1];
      if (last.type !== 'text') continue;
      const match = last.value.match(/\s*\{#([\w-]+)\}\s*$/);
      if (!match) continue;
      last.value = last.value.slice(0, match.index).trimEnd();
      node.data ??= {};
      node.data.hProperties ??= {};
      node.data.hProperties.id = match[1];
    }
  };
}

// Adapter is declared explicitly (instead of relying on Cloudflare's build-time
// auto-config) so the version is pinned in the lockfile and the build is
// reproducible. The site is static; the adapter packages it for Cloudflare.
// Used for canonical URLs, Open Graph tags, JSON-LD, sitemap, and robots.txt.
export default defineConfig({
  site: 'https://test-proxy-recorder.dev',
  adapter: cloudflare(),
  // Astro 7's default markdown processor is Sätteri; the remark pipeline is
  // opt-in now, and Starlight's own rehype passes ride on it too.
  markdown: {
    processor: unified({
      remarkPlugins: [remarkCustomHeadingIds],
      rehypePlugins: [rehypeScrollableTables],
    }),
  },
  vite: {
    define: {
      __CONTENT_LAST_MODIFIED__: JSON.stringify(contentLastModified),
      __LOCALE_DIRS__: JSON.stringify(localeDirs),
    },
  },
  integrations: [
    sitemap({
      // An unindexed locale is `noindex` on every page; listing it here would
      // ask for the opposite. The integration builds each URL's hreflang
      // cluster from the filtered set, so they drop out of those too.
      filter: (url) => !unindexedPrefixes.some((prefix) => new URL(url).pathname.startsWith(prefix)),
      // Emit <lastmod> per URL, from the newest commit touching that page's
      // source. Without it all ~265 URLs are dateless and search engines get
      // no signal about what changed.
      serialize(item) {
        item.lastmod = lastmodFor(new URL(item.url).pathname);
        return item;
      },
      // Group each page with its translations via <xhtml:link hreflang>. The
      // docs are published in six languages at the same paths under a locale
      // prefix; without this the translated pages look like unrelated
      // near-duplicates of the English ones rather than alternates of them.
      // English is the root locale and is served unprefixed, which the
      // integration handles: a first segment that isn't a known locale falls
      // through to `defaultLocale`.
      i18n: {
        defaultLocale: 'en',
        locales: sitemapLocales,
      },
    }),
    // Docs site. The hand-built marketing page owns `/` (src/pages/index.astro);
    // Starlight owns everything under `/docs/`, so docs content lives in the
    // nested `src/content/docs/docs/` directory (Starlight's documented way to
    // serve from a subpath). Docs are the source of truth — the README links
    // here rather than duplicating content.
    starlight({
      title: 'test-proxy-recorder',
      description:
        'VCR for Playwright — record real API responses once, replay them deterministically on CI. SSR proxy, browser HAR, and WebSockets.',
      // Decorative: the site title renders the same words beside it, and an alt
      // repeating them is `image-redundant-alt`.
      logo: { src: './public/favicon.svg', alt: '' },
      // Both for `tests/a11y.spec.ts` — see the integration.
      expressiveCode: {
        customizeTheme: liftThemeContrast,
        plugins: [preTabIndex],
      },
      // Adds a per-page <link> to that page's own `.md` mirror, ahead of the
      // site-wide llms.txt link below. See the component for why.
      components: { Head: './src/components/starlight/Head.astro' },
      // Advertise the machine-readable reference on every docs page so AI
      // agents can discover it. The homepage (src/pages/index.astro) adds the
      // same link via Layout.astro and additionally serves the Markdown inline
      // through Accept-header content negotiation (src/middleware.ts).
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/markdown',
            title: 'LLM-friendly reference (llms.txt)',
            href: '/llms.txt',
          },
        },
      ],
      // English is the source locale (served unprefixed); translations live
      // under src/content/docs/<lang>/docs/. Starlight localizes the sidebar
      // slugs automatically and falls back to English for any untranslated
      // page (e.g. the generated API reference, which stays English).
      defaultLocale: 'root',
      locales: starlightLocales,
      // Strips unindexed locales from the docs' hreflang clusters and marks
      // their own pages `noindex` — see the file.
      routeMiddleware: './src/starlightRouteData.ts',
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
      // Page entries carry no `label`. Starlight resolves a `slug` entry as
      // `translations[lang] || label || frontmatter.sidebar.label ||
      // frontmatter.title`, so with the label omitted each locale's sidebar
      // reads that locale's own translated page title — the labels here were
      // byte-identical to the English titles anyway, and duplicating them was
      // what pinned all nine sidebars to English. Only the strings with no
      // page behind them need a table: src/i18n/sidebar.ts.
      sidebar: [
        {
          ...sidebarLabel('gettingStarted'),
          items: [
            { ...sidebarLabel('introduction'), slug: 'docs' },
            { slug: 'docs/getting-started/quick-start' },
            { slug: 'docs/getting-started/manual-setup' },
            { slug: 'docs/getting-started/how-it-works' },
          ],
        },
        {
          ...sidebarLabel('guides'),
          items: [
            { slug: 'docs/guides/cli' },
            { slug: 'docs/guides/config' },
            { slug: 'docs/guides/secret-redaction' },
            { slug: 'docs/guides/control-endpoint' },
          ],
        },
        {
          ...sidebarLabel('integrations'),
          items: [
            { slug: 'docs/integrations/playwright' },
            { slug: 'docs/integrations/nextjs' },
            { slug: 'docs/integrations/tanstack-start' },
            { slug: 'docs/integrations/react-router', badge: sidebarBadge('soon') },
          ],
        },
        {
          ...sidebarLabel('reference'),
          items: [
            { slug: 'docs/reference/examples' },
            typeDocSidebarGroup,
            { slug: 'docs/reference/ai-agent-skills' },
            { slug: 'docs/reference/faq' },
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
