/**
 * Two accessibility gaps in expressive-code's output, both of which
 * `tests/a11y.spec.ts` fails on.
 */
import {
  contrast,
  hexToRgb,
  lc,
  oklchToRgb,
  rgbToOklch,
  toHex,
} from '@asmyshlyaev177/design-tokens';

/** What the a11y suite holds body-size text to, plus two points of margin:
 *  the suite scores the composited pixel, which rounds. */
const LC_FLOOR = 62;
const WCAG_FLOOR = 4.5;

const STEP = 0.005;

/** #rgb and #rrggbb only — an alpha channel has no fixed ground to score. */
const OPAQUE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const clears = (rgb, background) =>
  lc(rgb, background) >= LC_FLOOR && contrast(rgb, background) >= WCAG_FLOOR;

/**
 * Moves a colour away from its ground in OKLCH lightness until it clears both
 * floors, leaving hue and chroma alone so the palette still reads as itself.
 */
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
 * `customizeTheme`: Night Owl leaves a third of its tokens under the floor on
 * Starlight's code background — comments worst, but keywords, punctuation and
 * operators too. `theme.bg` is the ground the engine itself computes contrast
 * against, and Starlight pins it to the same colour the CSS variable resolves
 * to, so it is the real one.
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
 * Expressive-code's own client script gives an overflowing `<pre>` both
 * `tabindex="0"` and `role="region"`, and no accessible name — so every code
 * block on a page becomes an unnamed landmark and axe reports
 * `landmark-unique`. Until it runs (a 250 ms debounce behind a ResizeObserver)
 * the block is a scrollable region with no tab stop at all, which is
 * `scrollable-region-focusable`.
 *
 * Setting the tab stop at build satisfies the second and takes the script's
 * first branch out of play, so the role is never added and there is no landmark
 * to name. Its other branch still removes the attribute from blocks that turn
 * out not to overflow, which is the behaviour we want anyway.
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

/**
 * Starlight scrolls a wide markdown table on the table element itself, and a
 * scrollable region whose content holds no focusable element cannot be reached
 * by keyboard at all (axe `scrollable-region-focusable`). A tab stop on the
 * table is the smallest thing that gives it one.
 */
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
