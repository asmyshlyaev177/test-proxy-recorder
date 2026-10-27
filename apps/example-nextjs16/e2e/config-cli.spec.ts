import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { getFreePort, makeTempDir, type Proxy, startProxy } from './cli-proxy';
import { MOCK_BACKEND_URL } from './ports';

// Layer 2 (CLI integration) — see e2e/README.md. Each test spawns a real
// `test-proxy-recorder` process pointed at the mock backend (MOCK_BACKEND_URL), records
// one request, and asserts the resolved options by inspecting the saved
// .mock.json. No browser, so this is where the EXHAUSTIVE matrix lives: every
// config field is exercised from the config file, plus the CLI-overrides-config
// precedence for each flag. Requires the mock backend (started by `pnpm test:e2e`).

const CONFIG_FILE = 'test-proxy-recorder.config.ts';

interface Scenario {
  /** Config file contents. `__PORT__` is replaced with the bound port. */
  config: string;
  args?: string[];
  /** Relative dir the config writes recordings to (default './recordings'). */
  recordingsDir?: string;
  /** Don't pass --port; the config provides it via `__PORT__`. */
  portFromConfig?: boolean;
}

/** Write the config, spawn a proxy, run `fn`, and always clean up. */
async function withProxy(
  scenario: Scenario,
  fn: (proxy: Proxy) => Promise<void>,
): Promise<void> {
  const dir = await makeTempDir();
  const port = await getFreePort();
  await fs.writeFile(
    path.join(dir, CONFIG_FILE),
    scenario.config.replaceAll('__PORT__', String(port)),
  );
  const recordingsDir = path.resolve(dir, scenario.recordingsDir ?? './recordings');
  const proxy = await startProxy(dir, {
    args: scenario.args,
    port,
    passPortFlag: !scenario.portFromConfig,
    recordingsDir,
  });
  try {
    await fn(proxy);
  } finally {
    await proxy.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// Every config field, read from the config file and asserted to take effect.
test.describe('config file values are applied', () => {
  test('target — proxies to the configured backend', async () => {
    await withProxy(
      { config: `export default { target: '${MOCK_BACKEND_URL}', recordingsDir: './recordings' };` },
      async (proxy) => {
        const { json } = await proxy.record('cfg-target', {});
        const recording = json.recordings[0];
        // Reached the real backend: GET /todos returns a 200 JSON array.
        expect(recording.response.statusCode).toBe(200);
        expect(Array.isArray(JSON.parse(recording.response.body))).toBe(true);
      },
    );
  });

  test('port — proxy binds the port from the config', async () => {
    await withProxy(
      {
        config: `export default { target: '${MOCK_BACKEND_URL}', port: __PORT__, recordingsDir: './recordings' };`,
        portFromConfig: true,
      },
      async (proxy) => {
        // startProxy only became ready by polling the config's port, so binding
        // worked. Confirm a request records end-to-end on it.
        const { json } = await proxy.record('cfg-port', {});
        expect(json.recordings[0].response.statusCode).toBe(200);
      },
    );
  });

  test('recordingsDir — writes recordings to the configured directory', async () => {
    await withProxy(
      {
        config: `export default { target: '${MOCK_BACKEND_URL}', recordingsDir: './custom-rec' };`,
        recordingsDir: './custom-rec',
      },
      async (proxy) => {
        await proxy.record('cfg-dir', {});
        await expect(fs.access(proxy.recordingPath('cfg-dir'))).resolves.toBeUndefined();
      },
    );
  });

  test('timeout — auto-resets to transparent after the configured timeout', async () => {
    await withProxy(
      { config: `export default { target: '${MOCK_BACKEND_URL}', timeout: 500, recordingsDir: './recordings' };` },
      async (proxy) => {
        await proxy.setMode('record', 'cfg-timeout');
        expect((await proxy.getState()).mode).toBe('record');

        // A 500ms config timeout must flip the mode back well before the
        // 120s default would — poll up to 6s.
        const deadline = Date.now() + 6000;
        let mode = 'record';
        while (Date.now() < deadline) {
          mode = (await proxy.getState()).mode;
          if (mode === 'transparent') break;
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(mode).toBe('transparent');
      },
    );
  });

  test('redaction: false — commits secrets raw', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: false,
         };`,
      },
      async (proxy) => {
        const { json } = await proxy.record('cfg-disabled', {
          headers: { authorization: 'Bearer raw-token' },
        });
        expect(json.recordings[0].request.headers.authorization).toBe('Bearer raw-token');
      },
    );
  });

  test('redaction.headers — redacts the configured extra header', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { headers: ['x-custom-secret'] },
         };`,
      },
      async (proxy) => {
        const { json } = await proxy.record('cfg-headers', {
          headers: { 'x-custom-secret': 'leak-me' },
        });
        expect(json.recordings[0].request.headers['x-custom-secret']).toBe('[REDACTED]');
      },
    );
  });

  test('redaction.bodyPatterns — redacts matching tokens in bodies', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { bodyPatterns: [/sk_live_\\w+/g] },
         };`,
      },
      async (proxy) => {
        const { raw } = await proxy.record('cfg-body', {
          method: 'POST',
          path: '/todos',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'token sk_live_ABC123 end' }),
        });
        expect(raw).not.toContain('sk_live_ABC123');
      },
    );
  });

  test('redaction.allowHeaders — exempts a default-redacted header', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { allowHeaders: ['cookie'] },
         };`,
      },
      async (proxy) => {
        const { json } = await proxy.record('cfg-allow-headers', {
          headers: { cookie: 'session=keep-me', authorization: 'Bearer x' },
        });
        const headers = json.recordings[0].request.headers;
        // cookie is allow-listed, so it survives; authorization is still redacted.
        expect(headers.cookie).toBe('session=keep-me');
        expect(headers.authorization).toBe('[REDACTED]');
      },
    );
  });

  test('redaction.allowCookies — keeps only the allow-listed cookie', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { allowCookies: ['theme'] },
         };`,
      },
      async (proxy) => {
        const { json } = await proxy.record('cfg-allow-cookies', {
          headers: { cookie: 'session=secret; theme=dark' },
        });
        // The session value is redacted; the allow-listed theme cookie survives.
        expect(json.recordings[0].request.headers.cookie).toBe(
          'session=[REDACTED]; theme=dark',
        );
      },
    );
  });

  test('redaction.placeholder — uses the configured replacement string', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { placeholder: '###HIDDEN###' },
         };`,
      },
      async (proxy) => {
        const { json } = await proxy.record('cfg-placeholder', {
          headers: { authorization: 'Bearer secret' },
        });
        expect(json.recordings[0].request.headers.authorization).toBe('###HIDDEN###');
      },
    );
  });
});

// CLI flags take precedence over the same field in the config file.
test.describe('CLI flags override config file', () => {
  test('positional target overrides config.target', async () => {
    await withProxy(
      {
        // Config points at a dead port; the CLI argument must win.
        config: `export default { target: 'http://localhost:1', recordingsDir: './recordings' };`,
        args: [MOCK_BACKEND_URL],
      },
      async (proxy) => {
        const { json } = await proxy.record('cli-target', {});
        expect(json.recordings[0].response.statusCode).toBe(200);
      },
    );
  });

  test('--dir overrides config.recordingsDir', async () => {
    await withProxy(
      {
        config: `export default { target: '${MOCK_BACKEND_URL}', recordingsDir: './rec-cfg' };`,
        args: ['--dir', './rec-cli'],
        recordingsDir: './rec-cli',
      },
      async (proxy) => {
        await proxy.record('cli-dir', {});
        await expect(fs.access(proxy.recordingPath('cli-dir'))).resolves.toBeUndefined();
      },
    );
  });

  test('--redact enables redaction over a config that disables it', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: false,
         };`,
        args: ['--redact'],
      },
      async (proxy) => {
        const { json } = await proxy.record('cli-redact', {
          headers: { authorization: 'Bearer raw', 'x-api-key': 'raw-key' },
        });
        const headers = json.recordings[0].request.headers;
        // --redact turns redaction on (with defaults) even though the config
        // had it off — so the default Authorization header is redacted, while
        // x-api-key (not a default, not configured) is left as-is.
        expect(headers.authorization).toBe('[REDACTED]');
        expect(headers['x-api-key']).toBe('raw-key');
      },
    );
  });

  test('--redact-headers replaces (does not merge) the config header list', async () => {
    await withProxy(
      {
        config: `export default {
           target: '${MOCK_BACKEND_URL}',
           recordingsDir: './recordings',
           redaction: { headers: ['x-config-only'] },
         };`,
        args: ['--redact-headers', 'x-cli-only'],
      },
      async (proxy) => {
        const { json } = await proxy.record('cli-redact-headers', {
          headers: { 'x-cli-only': 'redact-this', 'x-config-only': 'keep-this' },
        });
        const headers = json.recordings[0].request.headers;
        expect(headers['x-cli-only']).toBe('[REDACTED]');
        // Config list was overridden by the CLI, so this is no longer redacted.
        expect(headers['x-config-only']).toBe('keep-this');
      },
    );
  });
});
