import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Truly black-box e2e test for `test-proxy-recorder init`.
 *
 * It drives the *built* CLI binary as an external process — no imports from the
 * library source — to prove the whole scaffold chain works end to end:
 *
 *   1. `test-proxy-recorder init` writes a config file.
 *   2. `test-proxy-recorder` (no args) auto-discovers that generated config.
 *   3. A real record -> replay cycle runs through the proxy against a mock
 *      backend, and replay serves the recording with the backend shut down.
 *
 * The temp working directory lives inside this app so the generated config's
 * `import 'test-proxy-recorder'` resolves through the workspace node_modules,
 * exactly as it would in a real consumer project.
 */

const APP_DIR = path.dirname(fileURLToPath(import.meta.url)).replace(
  /\/e2e$/,
  '',
);
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const CLI_BIN = path.join(
  REPO_ROOT,
  'packages',
  'test-proxy-recorder',
  'dist',
  'proxy.js',
);

const PROXY_PORT = 8233;
const BACKEND_PORT = 8234;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const SESSION_ID = 'init-smoke';
const RECORDED_BODY = JSON.stringify({ todos: ['scaffolded'] });

let workDir: string;
let backend: http.Server | null = null;
let backendHits = 0;
let proxy: ChildProcess | null = null;

beforeAll(() => {
  // The black box is the published artifact; build it if it is missing/stale
  // so the test is self-contained.
  if (!existsSync(CLI_BIN)) {
    const build = spawnSync(
      'pnpm',
      ['--filter', 'test-proxy-recorder', 'build'],
      { cwd: REPO_ROOT, stdio: 'inherit' },
    );
    expect(build.status).toBe(0);
  }

  workDir = mkdtempSync(path.join(APP_DIR, '.tmp-init-'));

  backend = http.createServer((_req, res) => {
    backendHits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(RECORDED_BODY);
  });
});

afterAll(async () => {
  if (proxy && proxy.exitCode === null) {
    proxy.kill('SIGKILL');
  }
  if (backend) {
    await new Promise<void>((resolve) => backend!.close(() => resolve()));
  }
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

describe('test-proxy-recorder init -> config -> record/replay', () => {
  it('scaffolds a config the proxy can auto-discover and replay from', async () => {
    // Seed an existing project: a package.json (one of whose scripts must be
    // preserved) and a Playwright config that init has to edit in place. This
    // exercises the modify-existing paths, not just file creation.
    writeFileSync(
      path.join(workDir, 'package.json'),
      JSON.stringify(
        {
          name: 'tmp-consumer',
          scripts: { build: 'echo build', dev: 'echo running-app' },
        },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      path.join(workDir, 'playwright.config.ts'),
      `import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './e2e',\n  fullyParallel: true,\n});\n`,
    );

    // 1. Scaffold via the real CLI. --no-install keeps it from shelling out to
    //    the Playwright CLI (no browser download in CI); the existing config is
    //    edited in place instead.
    const init = spawnSync(
      'node',
      [
        CLI_BIN,
        'init',
        BACKEND_URL,
        '--port',
        String(PROXY_PORT),
        '--dir',
        './recordings',
        '--no-install',
      ],
      { cwd: workDir, encoding: 'utf8' },
    );

    expect(init.status, init.stderr).toBe(0);
    const configPath = path.join(workDir, 'test-proxy-recorder.config.ts');
    expect(existsSync(configPath)).toBe(true);
    const configSrc = readFileSync(configPath, 'utf8');
    expect(configSrc).toContain(`target: '${BACKEND_URL}'`);
    expect(configSrc).toContain(`port: ${PROXY_PORT}`);

    // The existing Playwright config was edited in place: proxy wiring added,
    // original content kept.
    const pwSrc = readFileSync(
      path.join(workDir, 'playwright.config.ts'),
      'utf8',
    );
    expect(pwSrc).toContain('fullyParallel: true');
    expect(pwSrc).toContain("command: 'test-proxy-recorder'");
    expect(pwSrc).toContain(`http://localhost:${PROXY_PORT}/__control`);

    // package.json gained the proxy scripts without losing the existing one.
    const pkg = JSON.parse(
      readFileSync(path.join(workDir, 'package.json'), 'utf8'),
    );
    expect(pkg.scripts.build).toBe('echo build');
    expect(pkg.scripts.proxy).toBe('test-proxy-recorder');
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
    // The dev script is wrapped: original preserved as dev:app, dev runs both.
    expect(pkg.scripts['dev:app']).toBe('echo running-app');
    expect(pkg.scripts.dev).toContain('concurrently');
    expect(pkg.scripts.dev).toContain('proxy');

    // init prints the one manual step it can't automate: routing the app's
    // backend calls through the proxy, in dev/test only.
    expect(init.stdout).toContain('Point your app');
    expect(init.stdout).toContain('dev/test only');
    expect(init.stdout).toContain(`http://localhost:${PROXY_PORT}`);

    // 2. Start the backend and the proxy. The proxy gets NO arguments, so every
    //    setting (target, port, dir) must come from the generated config.
    await listen(backend!, BACKEND_PORT);
    proxy = spawn('node', [CLI_BIN], {
      cwd: workDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    await waitForControl(PROXY_PORT);

    // 3. Record a request through the proxy.
    await setMode(PROXY_PORT, 'record', SESSION_ID);
    const recorded = await proxyGet(PROXY_PORT, '/api/todos');
    expect(recorded.status).toBe(200);
    expect(recorded.body).toBe(RECORDED_BODY);
    expect(backendHits).toBe(1);

    // Flush the session to disk by leaving record mode.
    await setMode(PROXY_PORT, 'transparent', SESSION_ID);
    const recordingsDir = path.join(workDir, 'recordings');
    expect(readdirSync(recordingsDir)).toContain(`${SESSION_ID}.mock.json`);

    // 4. Replay with the backend shut down: served entirely from the recording.
    await new Promise<void>((resolve) => backend!.close(() => resolve()));
    backend = null;
    const hitsBeforeReplay = backendHits;

    await setMode(PROXY_PORT, 'replay', SESSION_ID);
    const replayed = await proxyGet(PROXY_PORT, '/api/todos');
    expect(replayed.status).toBe(200);
    expect(replayed.body).toBe(RECORDED_BODY);
    // Backend is down and was never called again — proof it came from disk.
    expect(backendHits).toBe(hitsBeforeReplay);
  });
});

// --- helpers ---------------------------------------------------------------

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve) => server.listen(port, () => resolve()));
}

async function waitForControl(port: number): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await proxyRequest(port, 'GET', '/__control');
      if (res.status === 200) return;
    } catch {
      // proxy not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('proxy /__control never became ready');
}

async function setMode(port: number, mode: string, id: string): Promise<void> {
  const res = await proxyRequest(
    port,
    'POST',
    '/__control',
    JSON.stringify({ mode, id }),
    { 'content-type': 'application/json' },
  );
  if (res.status !== 200) {
    throw new Error(`setMode ${mode} failed: ${res.status} ${res.body}`);
  }
}

function proxyGet(port: number, urlPath: string) {
  return proxyRequest(port, 'GET', urlPath);
}

function proxyRequest(
  port: number,
  method: string,
  urlPath: string,
  body?: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path: urlPath, method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: data }),
        );
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
