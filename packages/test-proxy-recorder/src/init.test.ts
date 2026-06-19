import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CONFIG_FILENAME,
  detectNextjs,
  type InitOptions,
  type InitResult,
  injectProxyIntoConfig,
  injectRegisterProxyFetch,
  parseInitArgs,
  renderAgentPrompt,
  renderConfig,
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

  it('parses the major version for Next.js 16+', () => {
    writeNextPkg('^16.2.4');
    expect(detectNextjs(dir)).toEqual({ major: 16 });
  });

  it('parses the major version for Next.js 15 and earlier', () => {
    writeNextPkg('~15.0.0');
    expect(detectNextjs(dir)).toEqual({ major: 15 });
  });

  it('returns a null major when the version is non-numeric', () => {
    writeNextPkg('latest');
    expect(detectNextjs(dir)).toEqual({ major: null });
  });
});

describe('injectRegisterProxyFetch', () => {
  const layout = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'App' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`;

  it('adds the import and a top-level registerProxyFetch() call after the imports', () => {
    const { contents, changed } = injectRegisterProxyFetch(layout);

    expect(changed).toBe(true);
    expect(contents).toContain(
      "import { registerProxyFetch } from 'test-proxy-recorder/nextjs';",
    );
    expect(contents).toContain('registerProxyFetch();');
    // Call sits after the import block but before the component.
    expect(contents.indexOf('registerProxyFetch();')).toBeLessThan(
      contents.indexOf('export default function RootLayout'),
    );
    expect(
      contents.indexOf("from 'test-proxy-recorder/nextjs'"),
    ).toBeGreaterThan(contents.indexOf("import './globals.css'"));
  });

  it('is idempotent — bails when already wired', () => {
    const wired = `import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
registerProxyFetch();
${layout}`;
    const { changed, reason } = injectRegisterProxyFetch(wired);

    expect(changed).toBe(false);
    expect(reason).toContain('registerProxyFetch');
  });

  it("bails on a client-component layout ('use client')", () => {
    const { changed, reason } = injectRegisterProxyFetch(
      `'use client';\n${layout}`,
    );

    expect(changed).toBe(false);
    expect(reason).toContain('use client');
  });

  it('bails when there is no import to anchor to', () => {
    const { changed, reason } = injectRegisterProxyFetch(
      'export default function L() { return null; }',
    );

    expect(changed).toBe(false);
    expect(reason).toBe('could not find an import to anchor to');
  });

  it('anchors after the import block, not inside a dynamic import() expression', () => {
    // Regression: a multi-line `import('…')` call expression must not be
    // mistaken for the last import statement — inserting inside it corrupts
    // the file (e.g. splitting `import('../core/auth/hub').then(...)`).
    const withDynamicImport = `import { type PropsWithChildren } from 'react';
import dynamic from 'next/dynamic';

import './globals.css';

const AuthHubLazy = dynamic(() =>
  import('../core/auth/hub').then((mod) => ({ default: mod.AuthHub })),
);

export default function RootLayout({ children }: PropsWithChildren) {
  return <html><body>{children}</body></html>;
}
`;

    const { contents, changed } = injectRegisterProxyFetch(withDynamicImport);

    expect(changed).toBe(true);
    // The dynamic import statement is left intact.
    expect(contents).toContain(
      "import('../core/auth/hub').then((mod) => ({ default: mod.AuthHub })),",
    );
    // The injected call lands after the real import block and before the
    // dynamic() expression — never inside it.
    expect(contents.indexOf('registerProxyFetch();')).toBeLessThan(
      contents.indexOf('const AuthHubLazy'),
    );
    expect(contents.indexOf('registerProxyFetch();')).toBeGreaterThan(
      contents.indexOf("import './globals.css'"),
    );
  });
});

describe('runInit — Next.js SSR (registerProxyFetch in root layout)', () => {
  /** Create an app/layout.tsx under the temp dir. */
  const writeLayout = (rel = 'app/layout.tsx') => {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(
      abs,
      `import './globals.css';\n\nexport default function RootLayout({ children }) {\n  return children;\n}\n`,
    );
    return rel;
  };

  it('injects registerProxyFetch into the root layout for a Next.js project', () => {
    writeNextPkg('^16.2.4');
    writeLayout();

    const result = runInit(options(), dir);

    expect(statusOf(result, 'app/layout.tsx')).toBe('updated');
    expect(read('app/layout.tsx')).toContain(
      "import { registerProxyFetch } from 'test-proxy-recorder/nextjs';",
    );
    expect(read('app/layout.tsx')).toContain('registerProxyFetch();');
  });

  it('finds the layout under src/', () => {
    writeNextPkg('^16.2.4');
    writeLayout('src/app/layout.tsx');

    const result = runInit(options(), dir);

    expect(statusOf(result, 'src/app/layout.tsx')).toBe('updated');
  });

  it('skips (with guidance) when no root layout exists', () => {
    writeNextPkg('^16.2.4');

    const result = runInit(options(), dir);

    const action = result.actions.find((a) => a.relPath.includes('layout'));
    expect(action?.status).toBe('skipped');
    expect(action?.detail).toContain('no root layout');
  });

  it('does not wire anything for a non-Next.js project', () => {
    writeLayout();

    const result = runInit(options(), dir);

    expect(result.actions.some((a) => a.relPath.includes('layout'))).toBe(
      false,
    );
    // Layout is left untouched.
    expect(read('app/layout.tsx')).not.toContain('registerProxyFetch');
  });

  it('leaves an already-wired layout alone (skipped, not double-wired)', () => {
    writeNextPkg('^16.2.4');
    const abs = path.join(dir, 'app/layout.tsx');
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(
      abs,
      `import { registerProxyFetch } from 'test-proxy-recorder/nextjs';\nregisterProxyFetch();\nexport default function L({ children }) { return children; }\n`,
    );

    const result = runInit(options(), dir);

    expect(statusOf(result, 'app/layout.tsx')).toBe('skipped');
    expect(
      read('app/layout.tsx').match(/registerProxyFetch\(\)/g)?.length,
    ).toBe(1);
  });
});

describe('renderAgentPrompt', () => {
  it('fills the template with the proxy URL, target, and recordings dir', () => {
    const out = renderAgentPrompt(
      options({ port: 8123, target: 'http://localhost:4000', dir: './rec' }),
    );

    expect(out).toContain('http://localhost:8123');
    expect(out).toContain('http://localhost:4000');
    expect(out).toContain('./rec');
    // No unsubstituted placeholders left.
    expect(out).not.toMatch(/\{\{.*?\}\}/);
  });

  it('carries the canonical prompt content (skills, helpers, numbered steps)', () => {
    const out = renderAgentPrompt(options());

    expect(out).toContain('npx @tanstack/intent');
    expect(out).toContain('registerProxyFetch()');
    expect(out).toContain('registerProxyAxios(instance)');
    expect(out).toContain('TEST_PROXY_RECORDER_ENABLED=true');
    expect(out).toMatch(/^1\. /m);
    expect(out).toContain('Never commit secrets.');
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
