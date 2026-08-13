// Everything the site needs to render a page in a language: the locale table,
// the per-locale values that used to be English literals in Layout.astro, and
// the URL helpers that keep a translated page pointing at its own siblings.
//
// The table itself comes from scripts/i18n/locales.mjs — the same file
// astro.config.mjs expands into the Starlight and sitemap locale maps, and the
// same one the README tooling reads. One list, four consumers.

import { ALL_LOCALES, LOCALES, SOURCE, SOURCE_LOCALE, type Locale } from '../../../../scripts/i18n/locales.mjs';

export { ALL_LOCALES, LOCALES, SOURCE, SOURCE_LOCALE };
export type { Locale };

/**
 * Open Graph wants `language_TERRITORY`, not a BCP 47 tag, and it is the one
 * place a bare language code is not accepted. The territory is a genuine
 * choice for the languages that have several; these are the largest
 * readerships, which is also what the copy is written for.
 */
const OG_TERRITORY: Record<string, string> = {
  en: 'en_US',
  'zh-CN': 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
  ru: 'ru_RU',
  es: 'es_ES',
  'pt-BR': 'pt_BR',
  fr: 'fr_FR',
  vi: 'vi_VN',
};

export const ogLocale = (code: string) => OG_TERRITORY[code] ?? 'en_US';

/**
 * Locale tag for date formatting, where it differs from the content locale.
 *
 * English here means `en-GB` — "12 August 2026", not "August 12, 2026". That
 * was the original hardcoded choice and it is the right one for a site whose
 * readers are mostly outside the US; deriving the format from the bare `en`
 * tag would silently flip every English page to the American order.
 */
const DATE_LOCALE: Record<string, string> = { en: 'en-GB' };

export const dateLocale = (code: string) => DATE_LOCALE[code] ?? code;

/**
 * URL prefix for a locale: `''` for English, `/ja` for the rest.
 *
 * English is served unprefixed — the same decision Starlight's
 * `defaultLocale: 'root'` makes for the docs, so both halves of the site agree
 * on where English lives.
 */
export const localePrefix = (code: string) => {
  const locale = ALL_LOCALES.find((l) => l.code === code);
  return !locale || locale.code === SOURCE_LOCALE ? '' : `/${locale.dir}`;
};

/** Read the locale out of a pathname; English for anything unprefixed. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return LOCALES.find((l) => l.dir === first) ?? SOURCE;
}

/**
 * The reciprocal hreflang cluster for a page, plus `x-default`.
 *
 * Every locale of a page lists every other one *and itself*; a cluster where
 * the pages disagree about who is in it is ignored wholesale by search
 * engines. `x-default` points at English, which is what an unmatched reader
 * should get.
 */
export function alternates(pathWithoutLocale: string, site: URL | undefined) {
  const origin = site ? site.origin : '';
  const href = (code: string) => `${origin}${localePrefix(code)}${pathWithoutLocale}`;
  return [
    ...ALL_LOCALES.map((l) => ({ hreflang: l.code, href: href(l.code) })),
    { hreflang: 'x-default', href: href(SOURCE_LOCALE) },
  ];
}

/**
 * Strip the locale segment from a pathname, giving the locale-independent path
 * that `alternates()` takes. `/ja/` and `/ja` both come back as `/`.
 */
export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname);
  if (locale.code === SOURCE_LOCALE) return pathname;
  const rest = pathname.slice(`/${locale.dir}`.length);
  return rest === '' ? '/' : rest;
}
