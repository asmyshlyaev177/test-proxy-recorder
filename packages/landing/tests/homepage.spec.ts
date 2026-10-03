/**
 * The marketing page's own rendered-output checks: what axe and Lighthouse do
 * not look at. Each pins a defect the 2026-10-03 reviews found in a build that
 * both audits scored clean (landing-review/, gitignored).
 */
import { expect, test, type Browser, type BrowserContextOptions } from '@playwright/test';

import { PREVIEW_URL } from '../playwright.audits.config';

const VIEWPORTS = {
  // WCAG 1.4.10 reflow: 320px is 1280px at 400% zoom.
  'narrow phone': { width: 320, height: 640 },
  phone: { width: 390, height: 844 },
  // Where the full header used to overflow (641-699px).
  'small tablet': { width: 700, height: 900 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

/** Test runs would otherwise count as visits in the site's Google Analytics. */
const ANALYTICS = /googletagmanager\.com|google-analytics\.com/;

async function openHome(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  await context.route(ANALYTICS, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${PREVIEW_URL}/`);
  return page;
}

// English only: Japanese and Chinese join a kana or hanzi to a link with no
// space, so the rule is the English one; the template's seams are the same.
test('inline code and links keep a gap on both sides', async ({ browser }) => {
  const page = await openHome(browser);
  const runOns = await page.evaluate(() => {
    const isGap = (char: string | undefined) => char === undefined || /[\s\p{P}]/u.test(char);
    const found: string[] = [];
    // Not the code blocks inside the setup steps' <li>: they are blocks, not inline.
    for (const inline of document.querySelectorAll('main :is(p, li, dd) :is(a, code):not(pre code)')) {
      const block = inline.closest('p, li, dd')!;
      const before = document.createRange();
      before.setStart(block, 0);
      before.setEndBefore(inline);
      const after = document.createRange();
      after.setStartAfter(inline);
      after.setEnd(block, block.childNodes.length);
      const prev = before.toString().at(-1);
      const next = after.toString().at(0);
      if (!isGap(prev) || !isGap(next)) found.push(`${prev ?? '|'}[${inline.textContent}]${next ?? '|'}`);
    }
    return found;
  });
  expect(runOns).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`code blocks render as panels with a visible copy button (${colorScheme})`, async ({ browser }) => {
    const page = await openHome(browser, { colorScheme });
    // Not the agent prompt: its labelled "Copy prompt" button replaces the icon.
    const blocks = await page.$$eval('main .expressive-code:not(.ai-setup *)', (groups) =>
      groups.map((group) => {
        const pre = getComputedStyle(group.querySelector('pre')!);
        const copy = group.querySelector('.copy button');
        return {
          background: pre.backgroundColor,
          // Bottom, not top: a terminal frame's title bar takes the top edge.
          border: Number.parseFloat(pre.borderBottomWidth),
          // EC paints the copy icon as a mask over this colour; empty, the button is invisible.
          copyIcon: copy ? getComputedStyle(copy, '::after').backgroundColor : 'none',
        };
      }),
    );
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    // EC reveals the button on hover (always, on touch screens), so it never sits over a line at rest.
    const firstFrame = page.locator('main .expressive-code .frame').first();
    await firstFrame.hover();
    const hovered = firstFrame.locator('.copy button');
    await expect.poll(() => hovered.evaluate((button) => Number(getComputedStyle(button).opacity))).toBeGreaterThanOrEqual(0.5);
    for (const block of blocks) {
      expect(block.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(block.border).toBeGreaterThan(0);
      expect(block.copyIcon).not.toMatch(/^(none|rgba\(0, 0, 0, 0\))$/);
    }
  });
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`no sideways scroll on a ${name} (${viewport.width}px)`, async ({ browser }) => {
    const page = await openHome(browser, { viewport });
    // The hero's packets widen the page only while one is mid-wire, so sample.
    let widest = 0;
    for (let sample = 0; sample < 10; sample += 1) {
      widest = Math.max(widest, await page.evaluate(() => document.documentElement.scrollWidth));
      await page.waitForTimeout(300);
    }
    expect(widest).toBeLessThanOrEqual(viewport.width);
  });
}

test('the phone header keeps Docs and GitHub, and the wordmark on one line', async ({ browser }) => {
  const page = await openHome(browser, { viewport: VIEWPORTS.phone });
  const nav = page.getByRole('navigation', { name: 'Site' });
  await expect(nav.getByRole('link', { name: 'Docs', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'GitHub', exact: true })).toBeVisible();
  const wordmark = await page.locator('.wordmark').boundingBox();
  expect(wordmark!.height).toBeLessThan(30);
});

for (const width of [320, 360]) {
  test(`every node in the hero diagram keeps its whole label at ${width}px`, async ({ browser }) => {
    const page = await openHome(browser, { viewport: { width, height: 800 } });
    const cut = await page.$$eval('.scene .node', (nodes) =>
      nodes.filter((node) => node.scrollWidth > node.clientWidth).map((node) => node.textContent),
    );
    expect(cut).toEqual([]);
  });
}

test('the agent prompt wraps on a phone and has one copy control', async ({ browser }) => {
  const page = await openHome(browser, { viewport: VIEWPORTS.phone, isMobile: true, hasTouch: true });
  const prompt = page.locator('.ai-setup pre');
  expect(await prompt.evaluate((pre) => pre.scrollWidth - pre.clientWidth)).toBe(0);
  await expect(page.locator('.ai-setup').getByRole('button')).toHaveCount(1);
});

// The edge cases read as failure modes before any reason to try the tool (2026-10-03 critique).
test('the recording sample comes before the comparison and the replay questions after Quick start', async ({ browser }) => {
  const page = await openHome(browser);
  const order = await page.$$eval('main section[id]', (sections) => sections.map((section) => section.id));
  expect(order.indexOf('recording')).toBeGreaterThan(-1);
  expect(order.indexOf('recording')).toBeLessThan(order.indexOf('comparison'));
  expect(order.indexOf('questions')).toBeGreaterThan(order.indexOf('quick-start'));
});

test('the setup tabs switch with the arrow keys and show one panel at a time', async ({ browser }) => {
  const page = await openHome(browser);
  const agent = page.getByRole('tab', { name: 'With your AI agent' });
  const manual = page.getByRole('tab', { name: 'By hand' });
  // The agent path is the default: most developers have a coding agent now (Alex, 2026-10-03).
  await expect(page.locator('#panel-agent')).toBeVisible();
  await expect(page.locator('#panel-manual')).toBeHidden();
  await agent.focus();
  await page.keyboard.press('ArrowRight');
  await expect(manual).toBeFocused();
  await expect(manual).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-manual')).toBeVisible();
  await expect(page.locator('#panel-agent')).toBeHidden();
});

test('the focused skip link is on top of the sticky header', async ({ browser }) => {
  const page = await openHome(browser);
  await page.keyboard.press('Tab');
  const isOnTop = await page.evaluate(() => {
    const link = document.querySelector('.skip-link')!;
    const box = link.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === link;
  });
  expect(isOnTop).toBe(true);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`focus rings clear 3:1 against what is drawn behind them (${colorScheme})`, async ({ browser }) => {
    const page = await openHome(browser, { colorScheme });
    const controls = [
      page.locator('.hero .copy-btn'),
      page.locator('.scene-toggle'),
      page.locator('main .expressive-code .copy button').first(),
      page.locator('.mech-guide').first(),
      page.locator('.ai-copy .copy-btn'),
      ...(await page.locator('.cta :is(a, button)').all()),
    ];
    for (const control of controls) {
      await control.scrollIntoViewIfNeeded();
      await control.focus();
      const ratio = await control.evaluate((element) => {
        // Computed colours come back as oklch(); a canvas resolves any CSS colour to sRGB.
        const toRgba = (color: string) => {
          const context = document.createElement('canvas').getContext('2d')!;
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data];
        };
        const luminance = ([r, g, b]: number[]) => {
          const [lr, lg, lb] = [r, g, b].map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        };
        const style = getComputedStyle(element);
        if (style.outlineStyle === 'none') return 0;
        // The ring is drawn just outside the box: the ground is whatever paints there.
        const box = element.getBoundingClientRect();
        const offset = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) / 2;
        const behind = document
          .elementsFromPoint(box.left - offset, box.top + box.height / 2)
          .find((node) => !element.contains(node) && toRgba(getComputedStyle(node).backgroundColor)[3] === 255);
        const ground = luminance(toRgba(getComputedStyle(behind ?? document.body).backgroundColor));
        const ring = luminance(toRgba(style.outlineColor));
        return (Math.max(ring, ground) + 0.05) / (Math.min(ring, ground) + 0.05);
      });
      expect(ratio, await control.evaluate((element) => element.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(3);
    }
  });
}

test('a copy button keeps its width, announces the copy and copies the text', async ({ browser }) => {
  const page = await openHome(browser, { permissions: ['clipboard-read', 'clipboard-write'] });
  const button = page.locator('.hero .copy-btn');
  const width = (await button.boundingBox())!.width;
  await button.click();
  await expect(button).toHaveClass(/copied/);
  expect((await button.boundingBox())!.width).toBe(width);
  await expect(page.locator('#copy-status')).toHaveText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(await button.getAttribute('data-copy'));

  await page.locator('.ai-copy .copy-btn').click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('npx test-proxy-recorder init');
  expect(prompt).not.toContain('```');
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`the demo video plays only without reduced motion (${reducedMotion})`, async ({ browser }) => {
    const page = await openHome(browser, { reducedMotion });
    const video = page.locator('video.demo-video');
    await video.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(reducedMotion === 'reduce');
  });
}

test('locale copies of untranslated docs are noindex and out of every cluster', async ({ request }) => {
  const fallback = await (await request.get(`${PREVIEW_URL}/ja/docs/reference/api/classes/proxyserver/`)).text();
  expect(fallback).toMatch(/<meta name="robots" content="noindex"/);
  expect(fallback).not.toMatch(/hreflang=/);

  const english = await (await request.get(`${PREVIEW_URL}/docs/reference/api/classes/proxyserver/`)).text();
  expect(english).not.toMatch(/hreflang="(?!en"|x-default")/);

  const sitemap = await (await request.get(`${PREVIEW_URL}/sitemap-0.xml`)).text();
  expect(sitemap).not.toMatch(/\/(zh-cn|ja|ru|es|fr)\/docs\/reference\/api\//);
});

test('one h1 naming Playwright, and a title that does not lead with VCR', async ({ browser }) => {
  const page = await openHome(browser);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText('Playwright');
  expect(await page.title()).not.toMatch(/^VCR/);
});
