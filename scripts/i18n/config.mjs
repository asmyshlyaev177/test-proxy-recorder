// What this repo translates. The locale set itself lives in locales.mjs and is
// identical across the three repos that share this toolkit; only this file
// differs between them.
//
// The Starlight docs under packages/landing/src/content/docs/ are NOT listed
// here: Starlight has its own locale layout (one directory per language) and
// its own drift tooling lives beside it. This file covers the repo's
// standalone Markdown only.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * `source` is the English file, relative to the repo root. Its translations
 * are `<name>.<locale>.<ext>` beside it.
 *
 * `toc: null` — this README has no table of contents and no in-page anchors
 * at all, which makes it the least breakable of the three.
 *
 * Unlike the other two repos, these translations do NOT reach npm: the
 * published package is packages/test-proxy-recorder, and its README is
 * materialised at pack time by copying this one in, then deleted again. Only
 * a file sitting in the package directory would ship.
 */
export const documents = [
  { source: 'README.md', toc: null },

  // The nine apps/example-*/README.md (1,120 lines, ~5,800 prose words; five
  // of them linked from the landing page and from this README) are English
  // only. Listing them here is all that is needed to bring them in — it is a
  // scope decision, not an oversight.
];
