/**
 * One page per template, not one page per route.
 *
 * The build emits **405** documents — 44 docs pages across nine locales, the
 * eight translated marketing pages and the 404, with the English `/` served
 * from the Worker on top — and auditing all of them would spend twenty
 * minutes re-measuring the same three layouts. Starlight renders every docs
 * page from one template, so the useful question is not "which pages" but
 * "which shapes of page": each entry below covers a shape the others don't,
 * and a page that is only a different *instance* of an existing shape adds
 * runtime and no signal.
 *
 * Add an entry when a genuinely new template lands — a new layout, a new
 * component on a page type, a generator emitting a structure TypeDoc doesn't.
 */
export const PAGES = [
  { path: '/', name: '/ (marketing page, video hero)' },
  { path: '/docs/', name: '/docs/ (Starlight index)' },
  {
    path: '/docs/getting-started/quick-start/',
    name: 'guide (prose + snippets)',
  },
  { path: '/docs/guides/config/', name: 'guide (expressive-code blocks)' },
  {
    path: '/docs/reference/api/classes/proxyserver/',
    name: 'API reference (TypeDoc-generated)',
  },
  // Script, not language, is what varies here: the site ships latin-only font
  // subsets, so anything outside that range falls back to a system font with
  // different metrics. Three shapes, not eight locales — Japanese covers the
  // CJK fallback (and stands in for ko and zh-CN), Vietnamese covers the case
  // that is neither, its diacritics sitting outside the latin subset while the
  // rest of the text sits inside it, and Russian covers Cyrillic. es/fr/pt-BR
  // are latin and render exactly like the English pages already audited above.
  { path: '/ja/docs/', name: '/ja/docs/ (localised, CJK fallback)' },
  { path: '/vi/docs/', name: '/vi/docs/ (localised, partial latin subset)' },
  { path: '/ru/docs/', name: '/ru/docs/ (localised, Cyrillic)' },
  // Chrome, a heading and a link: the floor that proves a page was measured at
  // all has to be the page's own, not the site's busiest.
  { path: '/404', name: '/404', minNodes: 4 },
];
