import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Installs the packed tarball into a project outside the workspace, the way a
 * user gets it from npm. A workspace link also resolves the package's
 * devDependencies, which hid the undeclared `ws` import that crashed the CLI on
 * start in 1.3.1.
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const PACKAGE_DIR = path.join(REPO_ROOT, 'packages', 'test-proxy-recorder');

let workDir: string;
let consumerDir: string;

beforeAll(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), 'tpr-packed-'));
  consumerDir = path.join(workDir, 'consumer');

  const pack = spawnSync('pnpm', ['pack', '--pack-destination', workDir], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
  });
  expect(pack.status, pack.stderr).toBe(0);
  const tarball = readdirSync(workDir).find((name) => name.endsWith('.tgz'));
  expect(tarball).toBeDefined();

  spawnSync('mkdir', [consumerDir]);
  writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true }),
  );
  // --legacy-peer-deps skips the @playwright/test peer: the CLI must start
  // without it, and leaving it out keeps the install small.
  const install = spawnSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      '--legacy-peer-deps',
      path.join(workDir, tarball!),
    ],
    { cwd: consumerDir, encoding: 'utf8' },
  );
  expect(install.status, install.stderr).toBe(0);
}, 180_000);

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

describe('packed test-proxy-recorder installed from its tarball', () => {
  it('starts the CLI with only its declared dependencies', () => {
    // npm links the bin as a symlink, so this also needs the shebang: without
    // it the shell runs the file and `import` is ImageMagick's, which waits for
    // a click — hence the timeout.
    const cli = spawnSync(
      path.join(consumerDir, 'node_modules', '.bin', 'test-proxy-recorder'),
      ['--help'],
      {
        cwd: consumerDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20_000,
      },
    );

    expect(cli.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain('Usage: test-proxy-recorder');
    expect(cli.stdout).toMatch(/^ {2}init \[target\]/m);
    expect(cli.stdout).toMatch(/^ {2}reset /m);
  });

  it('ships a README whose links work outside the repo', () => {
    const readme = readFileSync(
      path.join(consumerDir, 'node_modules', 'test-proxy-recorder', 'README.md'),
      'utf8',
    );
    const targets = [
      ...readme.matchAll(/\]\(([^)\s]+)\)/g),
      ...readme.matchAll(/src="([^"]+)"/g),
    ].map((match) => match[1]);

    expect(targets.length).toBeGreaterThan(0);
    // npm and agents reading node_modules see the README without the repo,
    // where ./README.ja.md or ./assets/... resolve to nothing.
    expect(
      targets.filter((target) => !/^(https?:|mailto:|#)/.test(target)),
    ).toEqual([]);
  });
});
