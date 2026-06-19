import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Black-box e2e coverage for `init`'s Next.js SSR wiring.
 *
 * Seeds throwaway Next.js projects, runs the *built* CLI against each, and
 * asserts it injects `registerProxyFetch()` into the root layout (and scaffolds
 * no middleware / proxy.ts — that approach is optional and no longer the
 * default). Nothing is imported from the library; the CLI is spawned as a real
 * process.
 */

const APP_DIR = path
  .dirname(fileURLToPath(import.meta.url))
  .replace(/\/e2e$/, '');
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

const LAYOUT_SRC = `import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

let workDir: string;

beforeAll(() => {
  if (!existsSync(CLI_BIN)) {
    const build = spawnSync(
      'pnpm',
      ['--filter', 'test-proxy-recorder', 'build'],
      { cwd: REPO_ROOT, stdio: 'inherit' },
    );
    expect(build.status).toBe(0);
  }
  workDir = mkdtempSync(path.join(APP_DIR, '.tmp-init-nextjs-'));
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

interface SeedOptions {
  range?: string;
  /** Where to write the root layout, or null to omit it entirely. */
  layoutPath?: string | null;
}

/** Seed a minimal Next.js project (package.json + optional root layout). */
function seedNextProject({
  range = '^16.2.4',
  layoutPath = 'app/layout.tsx',
}: SeedOptions = {}): string {
  const projectDir = mkdtempSync(path.join(workDir, 'next-'));
  writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      { name: 'tmp-nextjs-consumer', dependencies: { next: range } },
      null,
      2,
    ) + '\n',
  );
  if (layoutPath) {
    const abs = path.join(projectDir, layoutPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, LAYOUT_SRC);
  }
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

describe('init — Next.js SSR (registerProxyFetch in root layout)', () => {
  it('injects registerProxyFetch into app/layout.tsx', () => {
    const projectDir = seedNextProject({ range: '^16.2.4' });
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);

    const src = readFileSync(path.join(projectDir, 'app/layout.tsx'), 'utf8');
    expect(src).toContain(
      "import { registerProxyFetch } from 'test-proxy-recorder/nextjs';",
    );
    expect(src).toContain('registerProxyFetch();');
  });

  it('works the same for Next.js 15 (no version-specific convention)', () => {
    const projectDir = seedNextProject({ range: '^15.3.0' });
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);
    expect(
      readFileSync(path.join(projectDir, 'app/layout.tsx'), 'utf8'),
    ).toContain('registerProxyFetch();');
  });

  it('finds the layout under src/', () => {
    const projectDir = seedNextProject({ layoutPath: 'src/app/layout.tsx' });
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);
    expect(
      readFileSync(path.join(projectDir, 'src/app/layout.tsx'), 'utf8'),
    ).toContain('registerProxyFetch();');
  });

  it('scaffolds no proxy.ts / middleware.ts', () => {
    const projectDir = seedNextProject({ range: 'latest' });
    runInit(projectDir);

    expect(existsSync(path.join(projectDir, 'proxy.ts'))).toBe(false);
    expect(existsSync(path.join(projectDir, 'middleware.ts'))).toBe(false);
  });

  it('succeeds with printed guidance when there is no root layout', () => {
    const projectDir = seedNextProject({ layoutPath: null });
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);
    expect(existsSync(path.join(projectDir, 'app/layout.tsx'))).toBe(false);
    // Next-steps output points the user at registerProxyFetch.
    expect(init.stdout).toContain('registerProxyFetch');
  });

  it('does not wire a non-Next.js project', () => {
    const projectDir = mkdtempSync(path.join(workDir, 'non-next-'));
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'tmp', dependencies: { react: '^19.0.0' } }, null, 2) +
        '\n',
    );
    const layoutAbs = path.join(projectDir, 'app/layout.tsx');
    mkdirSync(path.dirname(layoutAbs), { recursive: true });
    writeFileSync(layoutAbs, LAYOUT_SRC);

    const init = runInit(projectDir);
    expect(init.status, init.stderr).toBe(0);
    expect(readFileSync(layoutAbs, 'utf8')).not.toContain('registerProxyFetch');
  });

  it('leaves an already-wired layout untouched (idempotent)', () => {
    const projectDir = seedNextProject({ range: '^16.2.4' });
    const layoutAbs = path.join(projectDir, 'app/layout.tsx');
    writeFileSync(
      layoutAbs,
      `import { registerProxyFetch } from 'test-proxy-recorder/nextjs';\nregisterProxyFetch();\n${LAYOUT_SRC}`,
    );

    const init = runInit(projectDir);
    expect(init.status, init.stderr).toBe(0);

    const out = readFileSync(layoutAbs, 'utf8');
    expect(out.match(/registerProxyFetch\(\)/g)?.length).toBe(1);
  });

  // Validates the whole chain: the prompt template is built into dist beside the
  // CLI, init reads it, fills the placeholders, and prints it. If the template
  // weren't shipped, renderAgentPrompt would throw and init would exit non-zero.
  it('ships the agent-prompt template and prints the filled-in prompt', () => {
    expect(existsSync(path.join(CLI_BIN, '..', 'agent-prompt.md'))).toBe(true);

    const projectDir = seedNextProject({ range: '^16.2.4' });
    const init = runInit(projectDir);

    expect(init.status, init.stderr).toBe(0);
    // Placeholders are filled with the resolved proxy URL + backend target.
    expect(init.stdout).toContain(`http://localhost:${PROXY_PORT}`);
    expect(init.stdout).toContain(BACKEND_URL);
    expect(init.stdout).toContain('registerProxyFetch()');
    expect(init.stdout).not.toMatch(/\{\{.*?\}\}/);
  });
});
