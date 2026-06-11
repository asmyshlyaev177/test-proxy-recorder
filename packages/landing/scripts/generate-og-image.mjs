#!/usr/bin/env node

/**
 * Generates /public/og.png (1200x630) from an SVG template.
 * Mirrors the landing's visual system: cobalt terminal panel, amber REC lamp,
 * record/replay flow. Colors approximate the OKLCH tokens in global.css.
 *
 * Usage:  node scripts/generate-og-image.mjs
 *         pnpm og:image
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/og.png');

const W = 1200;
const H = 630;

// Brand colors mirrored from src/styles/global.css (sRGB approximations).
const BG = '#101011'; // dark bg, chroma 0
const PANEL_EDGE = '#2e3650'; // panel-edge cobalt
const CHIP = '#1d2335'; // node chip fill
const INK = '#e9ebf3'; // panel ink
const MUTED = '#8d93a8'; // panel muted
const COBALT = '#8da2f0'; // luminous cobalt (links / replay)
const COBALT_DEEP = '#33437f'; // wire / glow base
const REC = '#f0553a'; // recording lamp
const GREEN = '#7fd6a4'; // success

// Pango (librsvg) resolves fonts via fontconfig; Noto is on the dev box and
// most Linux CI images.
const SANS = 'Noto Sans, system-ui, sans-serif';
const MONO = 'Noto Sans Mono, DejaVu Sans Mono, monospace';

const chip = (x, y, w, label, stroke = PANEL_EDGE, color = INK) => `
  <rect x="${x}" y="${y}" width="${w}" height="54" rx="10"
        fill="${CHIP}" stroke="${stroke}" stroke-width="1.5"/>
  <text x="${x + w / 2}" y="${y + 35}" text-anchor="middle"
        font-family="${MONO}" font-size="22" fill="${color}">${label}</text>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="cobalt-glow" cx="85%" cy="110%" r="80%">
      <stop offset="0%" stop-color="${COBALT_DEEP}" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="${COBALT_DEEP}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rec-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${REC}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${REC}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#cobalt-glow)"/>

  <!-- Terminal bar -->
  <g transform="translate(72, 64)">
    <circle cx="7" cy="0" r="7" fill="${PANEL_EDGE}"/>
    <circle cx="33" cy="0" r="7" fill="${PANEL_EDGE}"/>
    <circle cx="59" cy="0" r="7" fill="${PANEL_EDGE}"/>
    <text x="92" y="8" font-family="${MONO}" font-size="22" fill="${MUTED}">npx playwright test</text>
  </g>
  <text x="${W - 72}" y="72" text-anchor="end"
        font-family="${MONO}" font-weight="600" font-size="22"
        letter-spacing="2" fill="${REC}">● REC</text>
  <line x1="72" y1="100" x2="${W - 72}" y2="100"
        stroke="${INK}" stroke-opacity="0.1" stroke-width="1"/>

  <!-- Headline -->
  <text x="72" y="240" font-family="${SANS}" font-weight="700"
        font-size="104" letter-spacing="-3" fill="${INK}">Record once.</text>
  <text x="72" y="352" font-family="${SANS}" font-weight="700"
        font-size="104" letter-spacing="-3" fill="${COBALT}">Replay forever.</text>

  <!-- Subtitle -->
  <text x="72" y="420" font-family="${SANS}" font-weight="400"
        font-size="30" fill="${MUTED}">Deterministic Playwright tests — record real API responses,</text>
  <text x="72" y="460" font-family="${SANS}" font-weight="400"
        font-size="30" fill="${MUTED}">replay them on CI. No backend, no hand-written mocks.</text>

  <!-- Record flow -->
  <g>
    ${chip(72, 510, 170, 'your app')}
    <line x1="242" y1="537" x2="330" y2="537" stroke="${COBALT_DEEP}" stroke-width="2.5"/>
    <circle cx="286" cy="537" r="9" fill="url(#rec-glow)"/>
    <circle cx="286" cy="537" r="4.5" fill="${REC}"/>
    ${chip(330, 510, 130, 'proxy', COBALT, COBALT)}
    <line x1="460" y1="537" x2="548" y2="537" stroke="${COBALT_DEEP}" stroke-width="2.5"/>
    ${chip(548, 510, 160, 'real API')}
  </g>

  <!-- Replay result -->
  <text x="${W - 72}" y="545" text-anchor="end"
        font-family="${MONO}" font-size="24" fill="${GREEN}">✓ 200 OK · 3 ms · zero network</text>

  <!-- Bottom-right package name -->
  <text x="${W - 72}" y="592" text-anchor="end"
        font-family="${MONO}" font-size="22" fill="${MUTED}">npm i -D test-proxy-recorder</text>
</svg>`;

async function main() {
  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await writeFile(OUT, png);
  console.log(`✓ Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
