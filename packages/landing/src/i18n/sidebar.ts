// The docs sidebar labels that are *not* a page title.
//
// Starlight resolves a `slug` sidebar entry's label as
// `translations[lang] || label || frontmatter.sidebar.label || frontmatter.title`
// (@astrojs/starlight/utils/navigation.ts). Every page entry in the sidebar
// (astro.config.mjs) therefore carries no `label` at all: the label comes from
// the page's own frontmatter, which is already translated, in whatever locale
// the reader is in. One source, no duplication, nothing to keep in sync.
//
// What is left is the handful of strings with no page behind them — the four
// group headings, the docs landing entry (whose page title is the package
// name, not a nav label), and the "Soon" badge. Those live here, keyed by the
// BCP 47 `lang` Starlight matches on (`zh-CN`, `pt-BR` — the tag, not the
// lowercase directory).
//
// The generated API reference group is deliberately absent: starlight-typedoc
// builds that group itself and `replaceSidebarGroupPlaceholder` keeps only the
// `badge` off the placeholder, so a `translations` map on it is discarded.
// Its pages are generated from TypeScript and stay English, so an English
// label over an English subtree is the honest answer rather than a gap.

import { ALL_LOCALES } from './index';

/** Every label, by English key, then by language tag. */
const LABELS = {
  gettingStarted: {
    en: 'Getting started',
    'zh-CN': '快速开始',
    ja: 'はじめに',
    ko: '시작하기',
    ru: 'Начало работы',
    es: 'Primeros pasos',
    'pt-BR': 'Primeiros passos',
    fr: 'Démarrage',
    vi: 'Bắt đầu',
  },
  guides: {
    en: 'Guides',
    'zh-CN': '指南',
    ja: 'ガイド',
    ko: '가이드',
    ru: 'Руководства',
    es: 'Guías',
    'pt-BR': 'Guias',
    fr: 'Guides',
    vi: 'Hướng dẫn',
  },
  integrations: {
    en: 'Integrations',
    'zh-CN': '集成',
    ja: '連携',
    ko: '통합',
    ru: 'Интеграции',
    es: 'Integraciones',
    'pt-BR': 'Integrações',
    fr: 'Intégrations',
    vi: 'Tích hợp',
  },
  reference: {
    en: 'Reference',
    'zh-CN': '参考',
    ja: 'リファレンス',
    ko: '레퍼런스',
    ru: 'Справочник',
    es: 'Referencia',
    'pt-BR': 'Referência',
    fr: 'Référence',
    vi: 'Tham khảo',
  },
  introduction: {
    en: 'Introduction',
    'zh-CN': '简介',
    ja: '概要',
    ko: '소개',
    ru: 'Введение',
    es: 'Introducción',
    'pt-BR': 'Introdução',
    fr: 'Introduction',
    vi: 'Giới thiệu',
  },
  soon: {
    en: 'Soon',
    'zh-CN': '即将推出',
    ja: '近日公開',
    ko: '준비 중',
    ru: 'Скоро',
    es: 'Pronto',
    'pt-BR': 'Em breve',
    fr: 'Bientôt',
    vi: 'Sắp có',
  },
} as const satisfies Record<string, Record<string, string>>;

type LabelKey = keyof typeof LABELS;

// A missing language would silently fall back to English in the sidebar, which
// is exactly the kind of gap nobody notices. Fail the build instead.
for (const [key, entry] of Object.entries(LABELS)) {
  const missing = ALL_LOCALES.filter((l) => !(l.code in entry));
  if (missing.length > 0) {
    throw new Error(
      `src/i18n/sidebar.ts: "${key}" has no label for ${missing.map((l) => l.code).join(', ')}`,
    );
  }
}

/** The English label plus the `translations` map Starlight's sidebar wants. */
export const label = (key: LabelKey) => ({
  label: LABELS[key].en,
  translations: Object.fromEntries(
    ALL_LOCALES.filter((l) => l.code !== 'en').map((l) => [
      l.code,
      LABELS[key][l.code as keyof (typeof LABELS)[LabelKey]],
    ]),
  ) as Record<string, string>,
});

/** Same, shaped as Starlight's i18n badge config. */
export const badge = (key: LabelKey) => ({
  text: Object.fromEntries(
    ALL_LOCALES.map((l) => [l.code, LABELS[key][l.code as keyof (typeof LABELS)[LabelKey]]]),
  ) as Record<string, string>,
});
