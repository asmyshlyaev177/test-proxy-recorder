/**
 * ISO-8601 date of the HEAD commit, injected by `vite.define` in
 * astro.config.mjs. See scripts/build-date.mjs.
 */
declare const __CONTENT_LAST_MODIFIED__: string;

/**
 * Content-directory name of every non-English locale (`['es', 'fr', …]`),
 * injected by `vite.define` in astro.config.mjs from the single locale table
 * in scripts/i18n/locales.mjs. Anything that needs to tell a translated page
 * from an English one reads this rather than spelling the list out again.
 */
declare const __LOCALE_DIRS__: readonly string[];
