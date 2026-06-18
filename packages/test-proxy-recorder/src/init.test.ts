import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CONFIG_FILENAME,
  detectNextjs,
  type InitOptions,
  type InitResult,
  injectProxyIntoConfig,
  parseInitArgs,
  renderConfig,
  renderNextMiddleware,
  runInit,
  type ScaffoldStatus,
} from './init.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'tpr-init-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const options = (overrides: Partial<InitOptions> = {}): InitOptions => ({
  target: 'http://localhost:3000',
  port: 8100,
  dir: './e2e/recordings',
  force: false,
  // Filesystem-only tests never run the Playwright CLI.
  install: false,
  ...overrides,
});

/** Status of one scaffolded path, by relative path. */
function statusOf(result: InitResult, relPath: string): ScaffoldStatus {
  const action = result.actions.find((a) => a.relPath === relPath);
  if (!action) throw new Error(`no action for ${relPath}`);
  return action.status;
}

const read = (relPath: string) => readFileSync(path.join(dir, relPath), 'utf8');

describe('renderConfig', () => {
  it('embeds the resolved target, port, and dir', () => {
    const out = renderConfig(
      options({ target: 'http://localhost:4242', port: 9100, dir: './rec' }),
    );

    expect(out).toContain("target: 'http://localhost:4242'");
    expect(out).toContain('port: 9100');
    expect(out).toContain("recordingsDir: './rec'");
  });

  it('produces an importable defineConfig default export', () => {
    const out = renderConfig(options());

    expect(out).toContain("import { defineConfig } from 'test-proxy-recorder'");
    expect(out).toContain('export default defineConfig(');
  });
});

describe('runInit — files', () => {
  it('scaffolds the config and e2e helpers', () => {
    const result = runInit(options({ target: 'http://localhost:5000' }), dir);

    expect(statusOf(result, CONFIG_FILENAME)).toBe('created');
    expect(statusOf(result, 'e2e/fixtures.ts')).toBe('created');
    expect(statusOf(result, 'e2e/global-teardown.ts')).toBe('created');

    expect(read(CONFIG_FILENAME)).toContain("target: 'http://localhost:5000'");
    expect(read('e2e/fixtures.ts')).toContain('playwrightProxy.before');
    expect(read('e2e/global-teardown.ts')).toContain('playwrightProxy');
  });

  it('leaves existing files untouched without --force', () => {
    writeFileSync(path.join(dir, CONFIG_FILENAME), 'EXISTING');

    const result = runInit(options(), dir);

    expect(statusOf(result, CONFIG_FILENAME)).toBe('skipped');
    expect(read(CONFIG_FILENAME)).toBe('EXISTING');
    // Other files are still created.
    expect(statusOf(result, 'e2e/fixtures.ts')).toBe('created');
  });

  it('overwrites existing files with --force', () => {
    writeFileSync(path.join(dir, CONFIG_FILENAME), 'EXISTING');

    const result = runInit(options({ force: true }), dir);

    expect(statusOf(result, CONFIG_FILENAME)).toBe('created');
    expect(read(CONFIG_FILENAME)).toContain('defineConfig');
  });
});

describe('runInit — Playwright config', () => {
  it('writes a default config when none exists', () => {
    const result = runInit(options({ port: 9123 }), dir);

    expect(statusOf(result, 'playwright.config.ts')).toBe('created');
    expect(read('playwright.config.ts')).toContain(
      'http://localhost:9123/__control',
    );
    expect(read('playwright.config.ts')).toContain(
      "globalTeardown: './e2e/global-teardown.ts'",
    );
  });

  it('edits an existing config in place', () => {
    const existing = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
});
`;
    writeFileSync(path.join(dir, 'playwright.config.ts'), existing);

    const result = runInit(options({ port: 8200 }), dir);

    expect(statusOf(result, 'playwright.config.ts')).toBe('updated');
    const out = read('playwright.config.ts');
    // Original content preserved...
    expect(out).toContain("testDir: './tests'");
    expect(out).toContain('fullyParallel: true');
    // ...and the proxy wiring added.
    expect(out).toContain("command: 'test-proxy-recorder'");
    expect(out).toContain('http://localhost:8200/__control');
    expect(out).toContain("globalTeardown: './e2e/global-teardown.ts'");
  });

  it('skips a config that already defines a webServer', () => {
    const existing = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: { command: 'next dev', url: 'http://localhost:3000' },
});
`;
    writeFileSync(path.join(dir, 'playwright.config.ts'), existing);

    const result = runInit(options(), dir);

    expect(statusOf(result, 'playwright.config.ts')).toBe('skipped');
    // Untouched.
    expect(read('playwright.config.ts')).toBe(existing);
  });
});

describe('injectProxyIntoConfig', () => {
  it('inserts webServer + globalTeardown into defineConfig', () => {
    const { contents, changed } = injectProxyIntoConfig(
      'export default defineConfig({ testDir: "./e2e" });',
      options({ port: 8100 }),
    );

    expect(changed).toBe(true);
    expect(contents).toContain("command: 'test-proxy-recorder'");
    expect(contents).toContain('http://localhost:8100/__control');
    expect(contents).toContain("globalTeardown: './e2e/global-teardown.ts'");
  });

  it('does not add a second globalTeardown when one exists', () => {
    const { contents, changed } = injectProxyIntoConfig(
      `export default defineConfig({ globalTeardown: './my-teardown.ts' });`,
      options(),
    );

    expect(changed).toBe(true);
    // webServer added, but the existing globalTeardown is left as the only one.
    expect(contents).toContain('webServer');
    expect(contents).toContain("globalTeardown: './my-teardown.ts'");
    expect(contents).not.toContain(
      "globalTeardown: './e2e/global-teardown.ts'",
    );
  });

  it('is idempotent — bails when already wired', () => {
    const wired = `export default defineConfig({
  webServer: { command: 'test-proxy-recorder', url: 'http://localhost:8100/__control' },
});`;
    const { changed, reason } = injectProxyIntoConfig(wired, options());

    expect(changed).toBe(false);
    expect(reason).toContain('test-proxy-recorder');
  });

  it('bails when the config object cannot be located', () => {
    const { changed, reason } = injectProxyIntoConfig(
      'const cfg = loadConfigFromSomewhere(); export default cfg;',
      options(),
    );

    expect(changed).toBe(false);
    expect(reason).toBe('could not locate the config object');
  });
});

describe('runInit — package.json scripts', () => {
  it('skips merging when there is no package.json', () => {
    const result = runInit(options(), dir);

    const action = result.actions.find((a) => a.relPath === 'package.json');
    expect(action?.status).toBe('skipped');
    expect(action?.detail).toBe('no package.json found');
  });

  it('merges scripts into an existing package.json without clobbering', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        { name: 'demo', scripts: { proxy: 'echo mine', build: 'tsc' } },
        null,
        2,
      ) + '\n',
    );

    const result = runInit(options(), dir);

    expect(statusOf(result, 'package.json')).toBe('updated');

    const pkg = JSON.parse(read('package.json'));
    // Existing keys are preserved.
    expect(pkg.scripts.proxy).toBe('echo mine');
    expect(pkg.scripts.build).toBe('tsc');
    // New keys are added.
    expect(pkg.scripts['proxy:reset']).toBe('test-proxy-recorder reset');
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
    expect(pkg.scripts['test:e2e:record']).toBe(
      'playwright test --workers 1 --ui',
    );
  });

  it('overwrites conflicting scripts with --force', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        { name: 'demo', scripts: { proxy: 'echo mine' } },
        null,
        2,
      ),
    );

    runInit(options({ force: true }), dir);

    expect(JSON.parse(read('package.json')).scripts.proxy).toBe(
      'test-proxy-recorder',
    );
  });

  it('reports skipped when every script already exists', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {
          proxy: 'a',
          'proxy:reset': 'b',
          'test:e2e': 'c',
          'test:e2e:record': 'd',
        },
      }),
    );

    const result = runInit(options(), dir);

    expect(statusOf(result, 'package.json')).toBe('skipped');
  });

  it('wraps an existing dev script to run the proxy concurrently', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { dev: 'next dev' } }, null, 2),
    );

    const result = runInit(options(), dir);

    expect(statusOf(result, 'package.json')).toBe('updated');

    const pkg = JSON.parse(read('package.json'));
    // Original dev command moved aside, dev now runs both via concurrently.
    expect(pkg.scripts['dev:app']).toBe('next dev');
    expect(pkg.scripts.dev).toContain('concurrently');
    expect(pkg.scripts.dev).toContain('proxy');
    expect(pkg.scripts.dev).toContain('dev:app');
    // concurrently is declared so the wrapped script can run.
    expect(pkg.devDependencies.concurrently).toBeDefined();
  });

  it('does not wrap dev when there is no dev script', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: { build: 'tsc' } }),
    );

    runInit(options(), dir);

    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.dev).toBeUndefined();
    expect(pkg.scripts['dev:app']).toBeUndefined();
  });

  it('leaves an already-wrapped dev script alone (idempotent)', () => {
    const dev = 'concurrently "pnpm proxy" "pnpm dev:app"';
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: { proxy: 'test-proxy-recorder', dev, 'dev:app': 'next dev' },
      }),
    );

    runInit(options(), dir);

    const pkg = JSON.parse(read('package.json'));
    // dev untouched; dev:app not double-wrapped.
    expect(pkg.scripts.dev).toBe(dev);
    expect(pkg.scripts['dev:app']).toBe('next dev');
  });
});

/** Write a package.json declaring a `next` dependency at `range`. */
const writeNextPkg = (range: string) =>
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ dependencies: { next: range } }, null, 2),
  );

describe('detectNextjs', () => {
  it('returns null when there is no package.json', () => {
    expect(detectNextjs(dir)).toBeNull();
  });

  it('returns null when the project does not depend on next', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    );
    expect(detectNextjs(dir)).toBeNull();
  });

  it('uses the proxy.ts convention for Next.js 16+', () => {
    writeNextPkg('^16.2.4');
    expect(detectNextjs(dir)).toEqual({ major: 16, useProxyConvention: true });
  });

  it('uses the middleware.ts convention for Next.js 15 and earlier', () => {
    writeNextPkg('~15.0.0');
    expect(detectNextjs(dir)).toEqual({ major: 15, useProxyConvention: false });
  });

  it('assumes the current convention when the version is non-numeric', () => {
    writeNextPkg('latest');
    expect(detectNextjs(dir)).toEqual({ major: null, useProxyConvention: true });
  });
});

describe('renderNextMiddleware', () => {
  it('exports proxy() for the proxy convention', () => {
    const out = renderNextMiddleware({ major: 16, useProxyConvention: true });
    expect(out).toContain('export function proxy(');
    expect(out).toContain(
      "import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs'",
    );
    expect(out).toContain('setNextProxyHeaders(request, response)');
  });

  it('exports middleware() for the middleware convention', () => {
    const out = renderNextMiddleware({ major: 15, useProxyConvention: false });
    expect(out).toContain('export function middleware(');
  });
});

describe('runInit — Next.js middleware', () => {
  it('scaffolds proxy.ts for a Next.js 16 project', () => {
    writeNextPkg('^16.2.4');

    const result = runInit(options(), dir);

    expect(statusOf(result, 'proxy.ts')).toBe('created');
    expect(read('proxy.ts')).toContain('export function proxy(');
  });

  it('scaffolds middleware.ts for a Next.js 15 project', () => {
    writeNextPkg('^15.3.0');

    const result = runInit(options(), dir);

    expect(statusOf(result, 'middleware.ts')).toBe('created');
    expect(read('middleware.ts')).toContain('export function middleware(');
  });

  it('does not scaffold middleware for a non-Next.js project', () => {
    const result = runInit(options(), dir);

    expect(
      result.actions.some(
        (a) => a.relPath === 'proxy.ts' || a.relPath === 'middleware.ts',
      ),
    ).toBe(false);
  });

  it('leaves an existing middleware file alone (skipped, not clobbered)', () => {
    writeNextPkg('^16.2.4');
    writeFileSync(path.join(dir, 'proxy.ts'), 'export const config = {};');

    const result = runInit(options(), dir);

    expect(statusOf(result, 'proxy.ts')).toBe('skipped');
    expect(read('proxy.ts')).toBe('export const config = {};');
  });
});

describe('parseInitArgs', () => {
  it('applies built-in defaults when no arguments are given', () => {
    expect(parseInitArgs([])).toEqual({
      target: 'http://localhost:3002',
      port: 8100,
      dir: './e2e/recordings',
      force: false,
      install: true,
    });
  });

  it('reads the positional target and flags', () => {
    const opts = parseInitArgs([
      'http://localhost:7000',
      '--port',
      '9000',
      '--dir',
      './recordings',
      '--force',
      '--no-install',
    ]);

    expect(opts).toEqual({
      target: 'http://localhost:7000',
      port: 9000,
      dir: './recordings',
      force: true,
      install: false,
    });
  });
});
