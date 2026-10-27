import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { envWithoutProxyPort } from './ports';

// Spawns the built `test-proxy-recorder` CLI on a port of the test's own and drives it over
// /__control, for the layer-2 specs (e2e/README.md). Imports nothing from the package.

// Resolve the package's built CLI via the workspace node_modules symlink.
// Playwright runs with cwd = the app dir (see other specs' use of process.cwd()).
const BIN = path.join(
  process.cwd(),
  'node_modules',
  'test-proxy-recorder',
  'dist',
  'proxy.js',
);

export const RECORDING_ID_HEADER = 'x-test-rcrd-id';

export async function getFreePort(): Promise<number> {
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

interface RecordRequest {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface Proxy {
  port: number;
  control: string;
  setMode: (mode: string, id?: string) => Promise<void>;
  getState: () => Promise<{ mode: string; id: string | null }>;
  /** Record a single request through the proxy and return the saved recording. */
  record: (id: string, request: RecordRequest) => Promise<{ raw: string; json: any }>;
  recordingPath: (id: string) => string;
  stop: () => Promise<void>;
}

interface StartOptions {
  /** Extra CLI args (target/port/dir/redaction flags). */
  args?: string[];
  /** Port to bind + poll. */
  port: number;
  /** Append `--port <port>`; set false when the port comes from the config file. */
  passPortFlag?: boolean;
  /** Absolute directory recordings are written to (for recordingPath). */
  recordingsDir: string;
}

/**
 * Spawn the proxy CLI in `cwd` (so config auto-discovery and relative dirs
 * resolve there) and wait until /__control is reachable.
 */
export async function startProxy(cwd: string, opts: StartOptions): Promise<Proxy> {
  const { port, passPortFlag = true, recordingsDir } = opts;
  const args = [...(opts.args ?? [])];
  if (passPortFlag) {
    args.push('--port', String(port));
  }

  const child: ChildProcess = spawn(process.execPath, [BIN, ...args], {
    cwd,
    env: envWithoutProxyPort(),
    // stdout is never read; a full pipe would block the proxy, which looks like a hang under test.
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  // Surface CLI errors (bad config, validation exits) instead of timing out blind.
  let stderr = '';
  child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));

  const control = `http://127.0.0.1:${port}/__control`;
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`proxy exited (code ${child.exitCode}) before ready:\n${stderr}`);
    }
    try {
      const res = await fetch(control);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`proxy did not become ready on :${port}:\n${stderr}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const setMode = async (mode: string, id?: string) => {
    await fetch(control, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, id }),
    });
  };

  const recordingPath = (id: string) =>
    path.join(recordingsDir, `${id}.mock.json`);

  return {
    port,
    control,
    setMode,
    async getState() {
      const res = await fetch(control);
      return res.json();
    },
    async record(id, request) {
      await setMode('record', id);
      const res = await fetch(`http://127.0.0.1:${port}${request.path ?? '/todos'}`, {
        method: request.method ?? 'GET',
        headers: { [RECORDING_ID_HEADER]: id, ...request.headers },
        body: request.body,
      });
      await res.text();
      // Switching away from record mode flushes and saves the session.
      await setMode('transparent', id);
      const raw = await fs.readFile(recordingPath(id), 'utf8');
      return { raw, json: JSON.parse(raw) };
    },
    recordingPath,
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise((r) => child.once('exit', r));
      }
    },
  };
}

export async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'tpr-e2e-'));
}
