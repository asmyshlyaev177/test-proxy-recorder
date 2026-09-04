import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

import { INDEXED_LOCALES, localeFromPath } from './i18n';

const indexedCodes = new Set([...INDEXED_LOCALES.map((l) => l.code), 'x-default']);

/**
 * The docs' half of the locale index policy (see `indexed` in
 * scripts/i18n/locales.mjs); Layout.astro is the marketing page's half.
 *
 * Starlight's default head lists every configured locale as an hreflang
 * alternate on every docs page. A `noindex` page named in a cluster is an
 * error in Search Console, so an unindexed locale is stripped from every
 * page's cluster — and its own pages get `noindex` and no cluster at all.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const isAlternate = (entry: (typeof route.head)[number]) =>
    entry.tag === 'link' && entry.attrs?.rel === 'alternate' && 'hreflang' in (entry.attrs ?? {});

  if (localeFromPath(context.url.pathname).indexed) {
    route.head = route.head.filter(
      (entry) => !isAlternate(entry) || indexedCodes.has(String(entry.attrs?.hreflang)),
    );
    return;
  }
  route.head = [
    ...route.head.filter((entry) => !isAlternate(entry)),
    { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } },
  ];
});
