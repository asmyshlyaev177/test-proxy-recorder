/**
 * The accessibility gate: axe-core for structure and semantics, `auditContrast`
 * for colour. One navigation feeds both, so a page is loaded once per theme
 * rather than once per audit.
 *
 * Neither half is redundant with the Lighthouse accessibility score.
 * Lighthouse 13.4 bundles axe-core 4.12 and runs 76 audits — 66 real rules plus
 * 10 manual checklist items that never execute — against axe's 104, in one
 * theme only, weighted into an average rather than a per-rule verdict. It
 * scores no element that holds no text node, which on a docs site is most of
 * the chrome.
 *
 * `pnpm test:tokens` proves the token file is sound; this proves the pages
 * actually reached for it. Both floors come from the package, so a retuned ramp
 * moves this suite with it.
 */
import {
  COMPREHENSIVE_TAGS,
  auditA11y,
  describeViolation,
} from '@asmyshlyaev177/design-tokens/axe';
import {
  auditContrast,
  contrastFailures,
  describeContrast,
} from '@asmyshlyaev177/design-tokens/contrast';
import { expect, test, type Page } from '@playwright/test';

import { PREVIEW_URL } from '../playwright.audits.config';
import { PAGES } from './pages';

/**
 * Starlight's skip link is `clip: rect(0, 0, 0, 0)` until it takes focus, so
 * the colours the audit reads off it are never painted. Focused it measures
 * Lc 66 dark and Lc 91 light, which is the state a reader actually sees.
 */
const CONTRAST_IGNORE = ['.sl-skip-link'];

/**
 * Rules axe declines to decide. Anything not listed fails the run, so a new
 * "needs review" finding gets looked at once rather than living unnoticed in a
 * section of the report nobody reads.
 */
const REVIEWED_INCOMPLETE = [
  // The hero clip is `muted` and silent by construction. WCAG 1.2.2 asks for
  // captions on prerecorded *audio*; there is none, and axe cannot tell a
  // silent track from an uncaptioned one.
  'video-caption',
];

/**
 * Both audits on one loaded page, every assertion soft: an axe violation must
 * not hide a contrast failure on the same page, or fixing one at a time turns
 * a single run into three.
 */
async function auditBoth(page: Page, minNodes: number) {
  const axe = await auditA11y(page, { tags: COMPREHENSIVE_TAGS });
  // A selector typo that scoped the scan to nothing would otherwise pass.
  expect.soft(axe.passes).toBeGreaterThan(0);
  expect.soft(axe.violations.map(describeViolation).join('\n')).toBe('');
  expect
    .soft(
      [...new Set(axe.incomplete.map((r) => r.id))].filter(
        (id) => !REVIEWED_INCOMPLETE.includes(id),
      ),
    )
    .toEqual([]);

  const { findings, unresolved } = await auditContrast(page, {
    ignore: CONTRAST_IGNORE,
  });
  // Without these, a gradient over the whole page would leave the suite green
  // having measured nothing.
  expect.soft(findings.length).toBeGreaterThan(minNodes);
  expect.soft(unresolved).toBeLessThan(findings.length);
  expect
    .soft(contrastFailures(findings).map(describeContrast).join('\n'))
    .toBe('');
}

// Starlight's theme select defaults to `auto`, so the OS preference is what
// picks the ramp on a first visit — both halves of it have to hold.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.use({ colorScheme });

    for (const { path, name, minNodes = 20 } of PAGES) {
      test(`${name} clears axe, WCAG 2 AA and the APCA floor`, async ({
        page,
      }) => {
        await page.goto(`${PREVIEW_URL}${path}`);
        await auditBoth(page, minNodes);
      });
    }
  });
}
