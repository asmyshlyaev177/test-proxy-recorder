// Locale code → that language's homepage copy.
//
// The imports are static so each locale's strings are bundled with the page
// that uses them and nothing else; a dynamic import keyed on the param would
// pull all nine into every route.

import { home as en } from './en';
import { home as es } from './es';
import { home as fr } from './fr';
import { home as ja } from './ja';
import { home as ko } from './ko';
import { home as ptBR } from './pt-br';
import { home as ru } from './ru';
import { home as vi } from './vi';
import { home as zhCN } from './zh-cn';
import type { HomeCopy } from './types';

export type { HomeCopy };

const BY_CODE: Record<string, HomeCopy> = {
  en,
  'zh-CN': zhCN,
  ja,
  ko,
  ru,
  es,
  'pt-BR': ptBR,
  fr,
  vi,
};

/**
 * Falls back to English for an unknown code rather than throwing.
 *
 * The only way to reach this with something unknown is a locale that exists in
 * the routing table but has no copy module yet, and an English homepage is a
 * better answer to that than a 500.
 */
export const homeCopy = (code: string): HomeCopy => BY_CODE[code] ?? en;
