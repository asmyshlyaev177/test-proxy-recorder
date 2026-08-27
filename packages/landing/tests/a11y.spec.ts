/**
 * axe for structure and semantics, `auditContrast` for colour, both against one
 * loaded page per theme. `pnpm test:tokens` proves the token file is sound;
 * this proves the pages reached for it, and both floors come from the package.
 *
 * Not covered by the Lighthouse project beside it: that runs 76 audits — 66
 * real axe rules plus 10 manual items that never execute — against axe's 104,
 * in one theme, weighted into an average, and scores no element without a text
 * node, which on a docs site is most of the chrome.
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

/** Starlight's skip link is `clip: rect(0, 0, 0, 0)` until focused, so what
 *  the audit reads off it is never painted. Focused: Lc 66 dark, Lc 91 light. */
const CONTRAST_IGNORE = ['.sl-skip-link'];

/** Rules axe declines to decide. Anything unlisted fails, so a new one gets a
 *  decision once instead of living unread in the report. */
const REVIEWED_INCOMPLETE = [
  // The hero clip is muted and silent. WCAG 1.2.2 wants captions on prerecorded
  // *audio*; axe cannot tell a silent track from an uncaptioned one.
  'video-caption',
];

/** Every assertion soft, so one half cannot hide the other. */
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
  // A gradient over the page would otherwise leave the suite green having
  // measured nothing.
  expect.soft(findings.length).toBeGreaterThan(minNodes);
  expect.soft(unresolved).toBeLessThan(findings.length);
  expect
    .soft(contrastFailures(findings).map(describeContrast).join('\n'))
    .toBe('');
}

// Starlight's theme select defaults to `auto`, so the OS preference picks the
// ramp on a first visit.
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
