import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// FULL end-to-end, as a black box. We stand up a completely isolated stack on
// free ports — all started via the CLI, nothing imported from the package:
//
//   mock backend  ──>  test-proxy-recorder (CLI, config-driven)  ──>  Next.js app
//   (own data file)    (own config file)                              (own `next start`)
//
// The proxy is controlled only over its public HTTP /__control endpoint (like
// `curl`). The goal is to prove EVERY config option is actually applied:
//   - target / port / recordingsDir   → drive real app traffic + record/replay
//                                        through a browser against the Next app
//   - redaction.*                      → the app emits no secrets, so these
//     (headers, allowHeaders,            proxy-layer options are exercised by
//      allowCookies, bodyPatterns,       sending a request through the SAME
//      placeholder, enabled)             running config proxy and reading the
//                                        saved recording
//   - timeout                          → mode auto-resets after the configured ms
//
// Isolation keeps this off the shared :8100 proxy, so it runs serially without
// disturbing the parallel browser suite.

const APP_NODE = process.execPath;
const PROXY_BIN = path.join(
  process.cwd(),
  'node_modules',
  'test-proxy-recorder',
  'dist',
  'proxy.js',
);
const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const MOCK_SERVER = path.join(process.cwd(), 'mock-backend', 'server.mjs');

const PLACEHOLDER = '###REDACTED###';
const SEEDED_TODO = 'Recorded through the config-driven proxy';
const SESSION_APP = 'config-e2e__ssr-through-config-proxy';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Poll an URL until it responds (any status), or throw after `timeoutMs`. */
async function waitForHttp(url: string, label: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`${label} not ready at ${url}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function stop(child: ChildProcess | undefined): Promise<void> {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }
}

// Serial: the tests share one spawned stack and step a single proxy through
// record -> replay and a couple of config reloads.
test.describe.configure({ mode: 'serial' });

test.describe('full app e2e — every config option applied', () => {
  let backend: ChildProcess;
  let proxy: ChildProcess;
  let app: ChildProcess;
  let tmpDir: string;
  let configPath: string;
  let recordingsDir: string;
  let backendPort: number;
  let proxyPort: number;
  let appPort: number;

  const appUrl = () => `http://127.0.0.1:${appPort}/`;
  const proxyUrl = (p = '') => `http://127.0.0.1:${proxyPort}${p}`;
  const backendUrl = (p = '') => `http://127.0.0.1:${backendPort}${p}`;

  /** The "rich" config used by most tests: exercises every redaction option. */
  const richConfig = () => `export default {
    target: 'http://localhost:${backendPort}',
    port: ${proxyPort},
    recordingsDir: ${JSON.stringify(recordingsDir)},
    redaction: {
      headers: ['x-api-key'],          // redact this extra header
      allowHeaders: ['authorization'], // ...but exempt a default-redacted one
      allowCookies: ['theme'],         // keep this cookie, redact the rest
      bodyPatterns: [/sk_live_\\w+/g],  // redact tokens in bodies
      placeholder: '${PLACEHOLDER}',   // custom replacement string
    },
  };`;

  const control = (mode: string, id: string) =>
    fetch(proxyUrl('/__control'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, id }),
    });

  const getMode = async (): Promise<string> =>
    (await fetch(proxyUrl('/__control')).then((r) => r.json())).mode;

  /** (Re)write the config file and (re)start the proxy on the fixed port. */
  async function startProxy(configBody: string): Promise<void> {
    await fs.writeFile(configPath, configBody);
    proxy = spawn(APP_NODE, [PROXY_BIN], { cwd: tmpDir, env: { ...process.env }, stdio: 'ignore' });
    await waitForHttp(proxyUrl('/__control'), 'proxy');
  }

  /** Record one request through the running config proxy; return the recording. */
  async function recordThroughProxy(
    id: string,
    req: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{ raw: string; json: any }> {
    await control('record', id);
    const res = await fetch(proxyUrl(req.path ?? '/todos'), {
      method: req.method ?? 'GET',
      headers: { 'x-test-rcrd-id': id, ...req.headers },
      body: req.body,
    });
    await res.text();
    await control('transparent', id); // flush + save
    const raw = await fs.readFile(path.join(recordingsDir, `${id}.mock.json`), 'utf8');
    return { raw, json: JSON.parse(raw) };
  }

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tpr-full-e2e-'));
    configPath = path.join(tmpDir, 'test-proxy-recorder.config.ts');
    recordingsDir = path.join(tmpDir, 'recordings');
    backendPort = await getFreePort();
    proxyPort = await getFreePort();
    appPort = await getFreePort();

    // Isolated mock backend with its own data file.
    backend = spawn(APP_NODE, [MOCK_SERVER], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MOCK_BACKEND_PORT: String(backendPort),
        MOCK_DATA_FILE: path.join(tmpDir, 'todos.json'),
      },
      stdio: 'ignore',
    });

    // Next app pointed at the proxy for SSR (BACKEND_URL is read at runtime).
    app = spawn(APP_NODE, [NEXT_BIN, 'start', '--port', String(appPort)], {
      cwd: process.cwd(),
      env: { ...process.env, BACKEND_URL: proxyUrl() },
      stdio: 'ignore',
    });

    await waitForHttp(backendUrl('/todos'), 'mock backend');
    await startProxy(richConfig()); // CLI proxy, no flags — config file only
    await waitForHttp(appUrl(), 'next app');
  });

  test.afterAll(async () => {
    await Promise.all([stop(app), stop(proxy), stop(backend)]);
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('target + port + recordingsDir: records the app SSR fetch', async ({ page }) => {
    const seed = await fetch(backendUrl('/todos'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: SEEDED_TODO }),
    });
    expect(seed.ok).toBe(true);

    await control('record', SESSION_APP);
    try {
      await page.goto(appUrl());
      // SSR-rendered (no client fetch on load): proves target+port from the
      // config file carried real app traffic to the backend.
      await expect(page.getByText(SEEDED_TODO)).toBeVisible();
    } finally {
      await control('transparent', SESSION_APP);
    }

    // recordingsDir from the config holds the saved SSR recording.
    const raw = await fs.readFile(
      path.join(recordingsDir, `${SESSION_APP}.mock.json`),
      'utf8',
    );
    const getTodos = JSON.parse(raw).recordings.find(
      (r: any) => r.request.method === 'GET' && r.request.url.includes('/todos'),
    );
    expect(getTodos).toBeTruthy();
    expect(getTodos.response.body).toContain(SEEDED_TODO);
  });

  test('replay: serves the recorded SSR response with the backend emptied', async ({ page }) => {
    const del = await fetch(backendUrl('/todos'), { method: 'DELETE' });
    expect(del.ok).toBe(true);

    await control('replay', SESSION_APP);
    try {
      await page.goto(appUrl());
      await expect(page.getByText(SEEDED_TODO)).toBeVisible();
    } finally {
      await control('transparent', SESSION_APP);
    }

    // The backend really is empty, so that render came from the recording.
    expect(await fetch(backendUrl('/todos')).then((r) => r.json())).toEqual([]);
  });

  test('redaction: headers, allowHeaders, allowCookies, bodyPatterns, placeholder', async () => {
    const { raw, json } = await recordThroughProxy('config-e2e__redaction', {
      method: 'POST',
      path: '/todos',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer keep-me', // exempted by allowHeaders
        'x-api-key': 'super-secret-key', // redacted by redaction.headers
        cookie: 'session=topsecret; theme=dark', // partial via allowCookies
      },
      body: JSON.stringify({ text: 'token sk_live_ABC123 end' }), // bodyPatterns
    });
    const headers = json.recordings[0].request.headers;

    // redaction.headers + custom placeholder
    expect(headers['x-api-key']).toBe(PLACEHOLDER);
    // redaction.allowHeaders — a default header left untouched
    expect(headers.authorization).toBe('Bearer keep-me');
    // redaction.allowCookies — keep `theme`, redact the rest with the placeholder
    expect(headers.cookie).toBe(`session=${PLACEHOLDER}; theme=dark`);
    // redaction.bodyPatterns — token gone from the saved file
    expect(raw).not.toContain('sk_live_ABC123');
  });

  test('redaction.enabled: false (config reload) commits secrets raw', async () => {
    await stop(proxy);
    await startProxy(`export default {
      target: 'http://localhost:${backendPort}',
      port: ${proxyPort},
      recordingsDir: ${JSON.stringify(recordingsDir)},
      redaction: { enabled: false },
    };`);

    const { json } = await recordThroughProxy('config-e2e__redaction-off', {
      headers: { authorization: 'Bearer raw-token', cookie: 'session=raw' },
    });
    const headers = json.recordings[0].request.headers;
    expect(headers.authorization).toBe('Bearer raw-token');
    expect(headers.cookie).toBe('session=raw');
  });

  test('timeout (config reload): mode auto-resets to transparent', async () => {
    await stop(proxy);
    await startProxy(`export default {
      target: 'http://localhost:${backendPort}',
      port: ${proxyPort},
      recordingsDir: ${JSON.stringify(recordingsDir)},
      timeout: 500,
    };`);

    await control('record', 'config-e2e__timeout');
    expect(await getMode()).toBe('record');

    // A 500ms config timeout must flip back well before the 120s default.
    const deadline = Date.now() + 6000;
    let mode = 'record';
    while (Date.now() < deadline) {
      mode = await getMode();
      if (mode === 'transparent') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(mode).toBe('transparent');
  });
});
