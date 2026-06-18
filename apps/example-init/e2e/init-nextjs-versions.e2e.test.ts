import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Black-box e2e coverage for the Next.js version detection in `init`.
 *
 * Seeds two throwaway projects — one declaring `next@^16`, one `next@^15` —
 * runs the *built* CLI against each, and asserts the correct middleware entry
 * point is scaffolded:
 *
 *   - Next.js 16+  →  `proxy.ts`      exporting `proxy()`
 *   - Next.js ≤15  →  `middleware.ts` exporting `middleware()`
 *
 * Nothing is imported from the library; the CLI is spawned as a real process.
 */

const APP_DIR = path.dirname(fileURLToPath(import.meta.url)).replace(/\/e2e$/, '');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const CLI_BIN = path.join(
  REPO_ROOT,
  'packages',
  'test-proxy-recorder',
  'dist',
  'proxy.js',
);

const BACKEND_URL = 'http://localhost:8235';
const PROXY_PORT = 8236;

let workDir: string;

beforeAll(() => {
  if (!existsSync(CLI_BIN)) {
    const build = spawnSync('pnpm', ['--filter', 'test-proxy-recorder', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    expect(build.status).toBe(0);
  }
  workDir = mkdtempSync(path.join(APP_DIR, '.tmp-init-nextjs-'));
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/** Seed a minimal Next.js project with the given `next` version range. */
function seedNextProject(range: string): string {
  const projectDir = mkdtempSync(path.join(workDir, 'next-'));
  writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: 'tmp-nextjs-consumer',
        dependencies: { next: range },
      },
      null,
      2,
    ) + '\n',
  );
  return projectDir;
}

/** Run `test-proxy-recorder init` in `projectDir` and return its result. */
function runInit(projectDir: string) {
  return spawnSync(
    'node',
    [
      CLI_BIN,
      'init',
      BACKEND_URL,
      '--port',
      String(PROXY_PORT),
      '--dir',
      './e2e/recordings',
      '--no-install',
    ],
    { cwd: projectDir, encoding: 'utf8' },
  );
}

describe('init — Next.js 16+ (proxy.ts convention)', () => {
  it('scaffolds proxy.ts exporting proxy()', () => {
    const projectDir = seedNextProject('^16.2.4');
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);

    const proxyPath = path.join(projectDir, 'proxy.ts');
    expect(existsSync(proxyPath)).toBe(true);

    const src = readFileSync(proxyPath, 'utf8');
    expect(src).toContain('export function proxy(');
    expect(src).toContain("import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs'");
    expect(src).toContain('setNextProxyHeaders(request, response)');
    expect(src).toContain("matcher: ['/");
  });

  it('does not create middleware.ts', () => {
    const projectDir = seedNextProject('^16.0.0');
    runInit(projectDir);

    expect(existsSync(path.join(projectDir, 'middleware.ts'))).toBe(false);
  });
});

describe('init — Next.js 15 (middleware.ts convention)', () => {
  it('scaffolds middleware.ts exporting middleware()', () => {
    const projectDir = seedNextProject('^15.3.0');
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);

    const mwPath = path.join(projectDir, 'middleware.ts');
    expect(existsSync(mwPath)).toBe(true);

    const src = readFileSync(mwPath, 'utf8');
    expect(src).toContain('export function middleware(');
    expect(src).toContain("import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs'");
    expect(src).toContain('setNextProxyHeaders(request, response)');
    expect(src).toContain("matcher: ['/");
  });

  it('does not create proxy.ts', () => {
    const projectDir = seedNextProject('~15.0.0');
    runInit(projectDir);

    expect(existsSync(path.join(projectDir, 'proxy.ts'))).toBe(false);
  });
});

describe('init — version edge cases', () => {
  it('uses the proxy.ts convention for non-numeric versions (e.g. "latest")', () => {
    const projectDir = seedNextProject('latest');
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);
    expect(existsSync(path.join(projectDir, 'proxy.ts'))).toBe(true);
    expect(existsSync(path.join(projectDir, 'middleware.ts'))).toBe(false);
  });

  it('does not scaffold any middleware file for a non-Next.js project', () => {
    const projectDir = mkdtempSync(path.join(workDir, 'non-next-'));
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(
        { name: 'tmp', dependencies: { react: '^19.0.0' } },
        null,
        2,
      ) + '\n',
    );

    const init = runInit(projectDir);
    expect(init.status, init.stderr).toBe(0);

    expect(existsSync(path.join(projectDir, 'proxy.ts'))).toBe(false);
    expect(existsSync(path.join(projectDir, 'middleware.ts'))).toBe(false);
  });

  it('leaves an existing proxy.ts untouched (skipped, not clobbered)', () => {
    const projectDir = seedNextProject('^16.2.4');
    const existing = '// my custom middleware\nexport const config = {};\n';
    writeFileSync(path.join(projectDir, 'proxy.ts'), existing);

    const init = runInit(projectDir);
    expect(init.status, init.stderr).toBe(0);

    expect(readFileSync(path.join(projectDir, 'proxy.ts'), 'utf8')).toBe(existing);
  });

  it('leaves an existing middleware.ts untouched (skipped, not clobbered)', () => {
    const projectDir = seedNextProject('^15.3.0');
    const existing = '// my custom middleware\nexport const config = {};\n';
    writeFileSync(path.join(projectDir, 'middleware.ts'), existing);

    const init = runInit(projectDir);
    expect(init.status, init.stderr).toBe(0);

    expect(readFileSync(path.join(projectDir, 'middleware.ts'), 'utf8')).toBe(existing);
  });
});
