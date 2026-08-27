/** Three gaps in expressive-code's and Starlight's output that
 *  `tests/a11y.spec.ts` fails on. */
import {
  contrast,
  hexToRgb,
  lc,
  oklchToRgb,
  rgbToOklch,
  toHex,
} from '@asmyshlyaev177/design-tokens';

/** The suite's body-text floor plus two points: it scores the composited
 *  pixel, which rounds. */
const LC_FLOOR = 62;
const WCAG_FLOOR = 4.5;

const STEP = 0.005;

/** #rgb and #rrggbb only — an alpha channel has no fixed ground to score. */
const OPAQUE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const clears = (rgb, background) =>
  lc(rgb, background) >= LC_FLOOR && contrast(rgb, background) >= WCAG_FLOOR;

/** Away from the ground in OKLCH lightness until both floors clear; hue and
 *  chroma untouched, so the palette still reads as itself. */
function lift(hex, background) {
  if (!OPAQUE_HEX.test(hex)) return hex;

  const { L, C, h } = rgbToOklch(hexToRgb(hex));
  const direction = L > rgbToOklch(background).L ? STEP : -STEP;

  let lightness = L;
  let rgb = oklchToRgb({ L: lightness, C, h });
  while (!clears(rgb, background) && lightness > 0 && lightness < 1) {
    lightness = Math.min(1, Math.max(0, lightness + direction));
    rgb = oklchToRgb({ L: lightness, C, h });
  }
  return lightness === L ? hex : toHex(rgb);
}

/**
 * `customizeTheme`. Night Owl leaves a third of its tokens under the floor on
 * Starlight's code background — comments worst, keywords and operators too.
 * `theme.bg` is the real ground: Starlight pins it to what the CSS variable
 * resolves to.
 */
export function liftThemeContrast(theme) {
  const background = hexToRgb(theme.bg);
  if (theme.fg) theme.fg = lift(theme.fg, background);
  for (const rule of theme.settings) {
    const { foreground } = rule.settings ?? {};
    if (foreground) rule.settings.foreground = lift(foreground, background);
  }
  return theme;
}

const findPre = (node) => {
  if (node?.tagName === 'pre') return node;
  for (const child of node?.children ?? []) {
    const found = findPre(child);
    if (found) return found;
  }
  return undefined;
};

/**
 * EC's client script gives an overflowing `<pre>` `tabindex="0"` and
 * `role="region"` with no name, so every code block becomes an unnamed
 * landmark (`landmark-unique`) — and until it runs, 250 ms behind a
 * ResizeObserver, the block is a scrollable region with no tab stop
 * (`scrollable-region-focusable`).
 *
 * Setting the tab stop at build answers the second and skips the branch that
 * adds the role. The script still strips both from blocks that do not
 * overflow, which is what we want anyway.
 */
export const preTabIndex = {
  name: 'a11y-pre-tabindex',
  hooks: {
    postprocessRenderedBlock: ({ renderData }) => {
      const pre = findPre(renderData.blockAst);
      // `tabIndex`, not `tabindex`: hast keys are property names, and the
      // lowercase spelling is dropped on serialisation without a word.
      if (pre) pre.properties.tabIndex = 0;
    },
  },
};

/** Starlight scrolls a wide table on the table element itself, and nothing
 *  inside is focusable — so the table carries the tab stop. */
export function rehypeScrollableTables() {
  const visit = (node) => {
    if (node.tagName === 'table') {
      node.properties ??= {};
      node.properties.tabIndex = 0;
    }
    for (const child of node.children ?? []) visit(child);
  };
  return visit;
}
