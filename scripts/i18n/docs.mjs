#!/usr/bin/env node
// The Starlight docs half of the i18n tooling.
//
// The READMEs put the locale in the filename (`README.ja.md`) and are handled
// by cli.mjs. Starlight puts it in a directory instead — English lives at
// src/content/docs/docs/**, and each translation mirrors that tree under
// src/content/docs/<locale>/docs/**. Same problem, different addressing, so
// the validators are shared and only the file-walking differs.
//
// The drift stamp lives in frontmatter here rather than in an HTML comment:
// half of these files are .mdx, where `<!-- … -->` is not a comment but a
// parse error.
//
//   node scripts/i18n/docs.mjs init     create missing translated pages
//   node scripts/i18n/docs.mjs status   what is translated, what drifted
//   node scripts/i18n/docs.mjs check    validate; non-zero exit on problems
//   node scripts/i18n/docs.mjs diff <locale> <page>
//   node scripts/i18n/docs.mjs stamp <locale> [page]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { blobHash, validate } from './documents.mjs';
import { findLocale, LOCALES } from './locales.mjs';

export const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

/** English docs tree, relative to the repo root. */
const SOURCE_DIR = 'packages/landing/src/content/docs/docs';
/** Where a locale's mirror of it lives. */
const targetDir = (locale) => `packages/landing/src/content/docs/${locale.dir}/docs`;

/**
 * Pages that must stay English and must not be mirrored.
 *
 * `docs/reference/api` is regenerated from the package's TypeScript by
 * starlight-typedoc on every build and is gitignored — a translated copy would
 * be overwritten or, worse, silently kept and served as a stale API reference.
 * Starlight falls back to the English page for anything a locale is missing,
 * which is exactly the wanted behaviour here.
 */
const EXCLUDE = ['reference/api'];

const args = process.argv.slice(2);
const command = args[0] ?? 'status';
const positional = args.slice(1).filter((a) => !a.startsWith('--'));
const flags = new Set(args.filter((a) => a.startsWith('--')));

const c = process.stdout.isTTY
  ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { dim: '', red: '', green: '', yellow: '', bold: '', off: '' };

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(path.join(repoRoot, dir))) {
    const rel = base ? `${base}/${entry}` : entry;
    if (EXCLUDE.some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
    if (statSync(path.join(repoRoot, dir, entry)).isDirectory()) {
      out.push(...walk(path.join(dir, entry), rel));
    } else if (/\.mdx?$/.test(entry)) {
      out.push(rel);
    }
  }
  return out.sort();
}

/** The English pages, as tree-relative paths like `guides/cli.md`. */
const pages = walk(SOURCE_DIR);

// ------------------------------------------------------------- frontmatter

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: null, rest: text };
  return { frontmatter: m[1], rest: text.slice(m[0].length) };
}

function readField(frontmatter, key) {
  const m = frontmatter?.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

/** Set or replace the two stamp fields, keeping everything else untouched. */
function writeStamp(file, { source, blob }) {
  const text = readFileSync(file, 'utf8');
  const { frontmatter, rest } = splitFrontmatter(text);
  if (frontmatter === null) throw new Error(`${file} has no frontmatter`);
  const without = frontmatter
    .split('\n')
    .filter((line) => !/^i18nSource(Blob)?:/.test(line))
    .join('\n')
    .replace(/\n+$/, '');
  writeFileSync(
    file,
    `---\n${without}\ni18nSource: ${source}\ni18nSourceBlob: ${blob}\n---\n${rest}`,
    'utf8',
  );
}

// -------------------------------------------------------------------- init

function init() {
  let created = 0;
  for (const locale of LOCALES) {
    for (const page of pages) {
      const sourceRel = `${SOURCE_DIR}/${page}`;
      const targetRel = `${targetDir(locale)}/${page}`;
      const targetAbs = path.join(repoRoot, targetRel);
      const blob = blobHash(repoRoot, sourceRel);

      if (existsSync(targetAbs)) {
        // Only stamp files that have never been stamped. Overwriting the blob
        // of an existing translation would erase the evidence that it is
        // behind — which is the one thing this is for.
        const { frontmatter } = splitFrontmatter(readFileSync(targetAbs, 'utf8'));
        if (!readField(frontmatter, 'i18nSourceBlob')) {
          writeStamp(targetAbs, { source: `docs/${page}`, blob: UNKNOWN_BLOB });
          console.log(`${c.yellow}?${c.off} ${targetRel} ${c.dim}(pre-existing, source revision unknown)${c.off}`);
        }
        continue;
      }

      mkdirSync(path.dirname(targetAbs), { recursive: true });
      writeFileSync(targetAbs, readFileSync(path.join(repoRoot, sourceRel), 'utf8'), 'utf8');
      writeStamp(targetAbs, { source: `docs/${page}`, blob });
      created += 1;
      console.log(`${c.green}+${c.off} ${targetRel}`);
    }
  }
  console.log(created ? `\n${created} page(s) created.` : '\nNothing to create.');
}

/**
 * Stamp value for a translation that predates this tooling: it exists, but
 * which English revision it came from is genuinely unknown, and guessing would
 * be worse than saying so.
 */
const UNKNOWN_BLOB = 'unknown';

// ------------------------------------------------------------------ report

function report({ failOnPending }) {
  let problems = 0;
  let pending = 0;
  let unknown = 0;

  for (const locale of LOCALES) {
    const rows = [];
    for (const page of pages) {
      const sourceRel = `${SOURCE_DIR}/${page}`;
      const targetRel = `${targetDir(locale)}/${page}`;
      const targetAbs = path.join(repoRoot, targetRel);

      if (!existsSync(targetAbs)) {
        rows.push({ page, state: 'missing', detail: '' });
        problems += 1;
        continue;
      }

      const sourceText = readFileSync(path.join(repoRoot, sourceRel), 'utf8');
      const targetText = readFileSync(targetAbs, 'utf8');
      const { frontmatter } = splitFrontmatter(targetText);
      const recorded = readField(frontmatter, 'i18nSourceBlob');
      const current = blobHash(repoRoot, sourceRel);

      if (recorded === UNKNOWN_BLOB) {
        rows.push({ page, state: 'unverified', detail: 'translated before stamping; revision unknown' });
        unknown += 1;
      } else if (recorded !== current) {
        rows.push({ page, state: 'stale', detail: `${(recorded ?? '?').slice(0, 8)} → ${current.slice(0, 8)}` });
        problems += 1;
      }

      // An untranslated skeleton is byte-identical to its source apart from
      // the stamp, which is the cheapest possible "is this still English?".
      const { rest: sourceBody } = splitFrontmatter(sourceText);
      const { rest: targetBody } = splitFrontmatter(targetText);
      if (sourceBody === targetBody) {
        rows.push({ page, state: 'untranslated', detail: '' });
        pending += 1;
        continue;
      }

      // Structural checks shared with the README side: code blocks, heading
      // shape and links have to survive translation.
      const structural = validate({
        sourceText: sourceBody,
        targetText: targetBody,
        baseName: page,
        locale: locale.code,
        currentBlob: current,
        linkPrefix: locale.dir,
      }).filter((p) => !['stale', 'pending', 'todo', 'no-header', 'switcher'].includes(p.kind));
      for (const p of structural) {
        rows.push({ page, state: p.kind, detail: p.detail });
        problems += 1;
      }
    }

    const bad = rows.filter((r) => r.state !== 'untranslated');
    const label = `${locale.code.padEnd(6)} ${locale.english.padEnd(22)}`;
    if (rows.length === 0) {
      console.log(`  ${label} ${c.green}ok${c.off} ${c.dim}(${pages.length} pages)${c.off}`);
      continue;
    }
    const untranslated = rows.filter((r) => r.state === 'untranslated').length;
    console.log(
      `  ${label} ${bad.length ? c.red : c.yellow}${bad.length} problem(s)${c.off}, ${untranslated}/${pages.length} untranslated`,
    );
    for (const r of bad.slice(0, 8)) {
      console.log(`         ${c.red}·${c.off} ${r.page}: ${r.state}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    if (bad.length > 8) console.log(`         ${c.dim}… and ${bad.length - 8} more${c.off}`);
  }

  console.log(
    `\n${problems ? c.red : c.green}${problems} problem(s)${c.off}, ${c.yellow}${pending} page(s) awaiting translation${c.off}` +
      (unknown ? `, ${c.yellow}${unknown} of unknown provenance${c.off}` : ''),
  );
  return problems + (failOnPending ? pending : 0);
}

// -------------------------------------------------------------- diff/stamp

function resolveLocale(input) {
  const locale = findLocale(input);
  if (!locale || locale.code === 'en') {
    console.error(`${c.red}Unknown locale "${input}". One of: ${LOCALES.map((l) => l.code).join(', ')}${c.off}`);
    process.exit(2);
  }
  return locale;
}

function diff() {
  const locale = resolveLocale(positional[0]);
  const only = positional[1];
  for (const page of pages) {
    if (only && page !== only && !page.startsWith(`${only}`)) continue;
    const sourceRel = `${SOURCE_DIR}/${page}`;
    const targetAbs = path.join(repoRoot, `${targetDir(locale)}/${page}`);
    if (!existsSync(targetAbs)) continue;
    const recorded = readField(splitFrontmatter(readFileSync(targetAbs, 'utf8')).frontmatter, 'i18nSourceBlob');
    const current = blobHash(repoRoot, sourceRel);
    if (!recorded || recorded === current || recorded === UNKNOWN_BLOB) continue;

    console.log(`\n${c.bold}${page}: ${recorded.slice(0, 8)} → ${current.slice(0, 8)}${c.off}`);
    let previous;
    try {
      previous = execFileSync('git', ['cat-file', 'blob', recorded], { cwd: repoRoot, encoding: 'utf8' });
    } catch {
      console.log(`${c.yellow}  blob ${recorded.slice(0, 8)} not in this repo${c.off}`);
      continue;
    }
    const scratch = path.join(repoRoot, `.i18n-diff-${recorded.slice(0, 8)}.tmp`);
    writeFileSync(scratch, previous, 'utf8');
    try {
      execFileSync('git', ['diff', '--no-color', '--no-index', scratch, path.join(repoRoot, sourceRel)], {
        cwd: repoRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
      });
    } catch (err) {
      if (err.status !== 1) throw err;
    } finally {
      rmSync(scratch, { force: true });
    }
  }
}

function stamp() {
  const locale = resolveLocale(positional[0]);
  const only = positional[1];
  let n = 0;
  for (const page of pages) {
    if (only && page !== only) continue;
    const targetAbs = path.join(repoRoot, `${targetDir(locale)}/${page}`);
    if (!existsSync(targetAbs)) continue;
    writeStamp(targetAbs, { source: `docs/${page}`, blob: blobHash(repoRoot, `${SOURCE_DIR}/${page}`) });
    n += 1;
  }
  console.log(`${c.green}✓${c.off} stamped ${n} ${locale.code} page(s) as current`);
}

switch (command) {
  case 'init':
    init();
    break;
  case 'status':
    report({ failOnPending: false });
    break;
  case 'check':
    process.exitCode = report({ failOnPending: flags.has('--strict') }) > 0 ? 1 : 0;
    break;
  case 'diff':
    diff();
    break;
  case 'stamp':
    stamp();
    break;
  default:
    console.error(`Unknown command "${command}".`);
    process.exit(2);
}
