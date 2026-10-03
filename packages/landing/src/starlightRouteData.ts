import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

import { INDEXED_LOCALES, LOCALES, SOURCE, localeFromPath } from './i18n';

const indexedCodes = new Set([...INDEXED_LOCALES.map((l) => l.code), 'x-default']);

/** Every docs entry id, `docs/guides/cli` and `ja/docs/guides/cli` alike. */
const entryIds = getCollection('docs').then((entries) => new Set(entries.map((entry) => entry.id)));

/**
 * The docs' half of the locale index policy (see `indexed` in
 * scripts/i18n/locales.mjs); Layout.astro is the marketing page's half.
 *
 * Starlight's default head lists every configured locale as an hreflang
 * alternate on every docs page. A `noindex` page named in a cluster is an
 * error in Search Console, so an unindexed locale is stripped from every
 * page's cluster — and its own pages get `noindex` and no cluster at all.
 *
 * The same goes for a page a locale has not translated: Starlight serves the
 * English text under that locale's URL. Search Console filed all ten of the
 * site's soft 404s under such copies of the generated API reference
 * (2026-10-03), so a fallback is `noindex`, and no page lists one as its
 * alternate.
 */
export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const isAlternate = (entry: (typeof route.head)[number]) =>
    entry.tag === 'link' && entry.attrs?.rel === 'alternate' && 'hreflang' in (entry.attrs ?? {});
  const locale = localeFromPath(context.url.pathname);

  if (!locale.indexed || route.isFallback) {
    route.head = [
      ...route.head.filter((entry) => !isAlternate(entry)),
      { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } },
    ];
    return;
  }

  const ids = await entryIds;
  const pageId = locale === SOURCE ? route.id : route.id.slice(locale.dir.length + 1);
  // English and x-default have no entry in LOCALES; they always exist.
  const hasPage = (code: string) => {
    const target = LOCALES.find((l) => l.code === code);
    return !target || ids.has(`${target.dir}/${pageId}`);
  };
  route.head = route.head.filter((entry) => {
    if (!isAlternate(entry)) return true;
    const code = String(entry.attrs?.hreflang);
    return indexedCodes.has(code) && hasPage(code);
  });
});
