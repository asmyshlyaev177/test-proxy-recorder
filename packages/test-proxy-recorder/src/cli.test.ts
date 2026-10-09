import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CliOptions, parseCliArgs } from './cli.js';

/** Assert redaction resolved to an enabled config object, and return it typed. */
function enabledRedaction(redaction: CliOptions['redaction']) {
  expect(redaction).not.toBe(false);
  return redaction as Exclude<CliOptions['redaction'], false>;
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'tpr-cli-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/** Write a config file and return its absolute path. */
function writeConfig(contents: string): string {
  const filePath = path.join(dir, 'tpr.config.ts');
  writeFileSync(filePath, contents);
  return filePath;
}

/** Invoke parseCliArgs with a synthetic argv (node + script + the given args). */
function run(args: string[]) {
  return parseCliArgs(['node', 'cli', ...args]);
}

describe('parseCliArgs precedence', () => {
  it('uses config-file values when no CLI flags are given', async () => {
    const config = writeConfig(
      `export default {
         target: 'http://localhost:7001',
         port: 7000,
         recordingsDir: './from-config',
         timeout: 5000,
         redaction: { headers: ['x-config'] },
       };`,
    );

    const opts = await run(['--config', config]);

    expect(opts.target).toBe('http://localhost:7001');
    expect(opts.port).toBe(7000);
    expect(opts.recordingsDir).toBe(
      path.resolve(process.cwd(), './from-config'),
    );
    expect(opts.timeout).toBe(5000);
    expect(enabledRedaction(opts.redaction).headers).toEqual(['x-config']);
  });

  it('lets CLI flags override config values', async () => {
    const config = writeConfig(
      `export default {
         target: 'http://localhost:7001',
         port: 7000,
         recordingsDir: './from-config',
       };`,
    );

    const opts = await run([
      'http://localhost:7002',
      '--config',
      config,
      '--port',
      '9000',
      '--dir',
      './from-cli',
    ]);

    // Positional target wins over config.target.
    expect(opts.target).toBe('http://localhost:7002');
    expect(opts.port).toBe(9000);
    expect(opts.recordingsDir).toBe(path.resolve(process.cwd(), './from-cli'));
  });

  it('falls back to built-in defaults when neither CLI nor config set a value', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001' };`,
    );

    const opts = await run(['--config', config]);

    // Same default as the Playwright helpers and `init`, so they find the proxy.
    expect(opts.port).toBe(8100);
    expect(opts.recordingsDir).toBe(
      path.resolve(process.cwd(), './recordings'),
    );
    expect(opts.timeout).toBe(120_000);
    // Redaction is on by default — an enabled config with no extra headers.
    expect(enabledRedaction(opts.redaction).headers).toEqual([]);
  });

  it('reads TEST_PROXY_RECORDER_PORT over the config, below --port', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001', port: 7000 };`,
    );
    vi.stubEnv('TEST_PROXY_RECORDER_PORT', '9100');

    const fromEnv = await run(['--config', config]);
    const fromFlag = await run(['--config', config, '--port', '9200']);

    expect(fromEnv.port).toBe(9100);
    expect(fromFlag.port).toBe(9200);
  });

  it('lets --timeout override config.timeout', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001', timeout: 5000 };`,
    );

    const opts = await run(['--config', config, '--timeout', '1234']);

    expect(opts.timeout).toBe(1234);
  });

  it('enables redaction when the config provides a redaction object', async () => {
    const config = writeConfig(
      `export default {
         target: 'http://localhost:7001',
         redaction: { headers: ['x-config'] },
       };`,
    );

    const opts = await run(['--config', config]);

    expect(enabledRedaction(opts.redaction).headers).toEqual(['x-config']);
  });

  it('treats redaction: false in config as disabled', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001', redaction: false };`,
    );

    const opts = await run(['--config', config]);

    expect(opts.redaction).toBe(false);
  });

  it('--no-redact disables redaction even when the config omits it', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001' };`,
    );

    const opts = await run(['--config', config, '--no-redact']);

    expect(opts.redaction).toBe(false);
  });

  it('--no-redact disables redaction over a config that enables it', async () => {
    const config = writeConfig(
      `export default {
         target: 'http://localhost:7001',
         redaction: { headers: ['x-config'] },
       };`,
    );

    const opts = await run(['--config', config, '--no-redact']);

    expect(opts.redaction).toBe(false);
  });

  it('--redact enables redaction over a config that disables it', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001', redaction: false };`,
    );

    const opts = await run(['--config', config, '--redact']);

    expect(opts.redaction).not.toBe(false);
  });

  it('CLI list flags replace (do not merge with) the config list', async () => {
    const config = writeConfig(
      `export default {
         target: 'http://localhost:7001',
         redaction: { headers: ['x-config-only'] },
       };`,
    );

    const opts = await run([
      '--config',
      config,
      '--redact-headers',
      'x-cli-only',
    ]);

    expect(enabledRedaction(opts.redaction).headers).toEqual(['x-cli-only']);
  });

  it('reads target from config when no positional argument is given', async () => {
    const config = writeConfig(
      `export default { target: 'http://localhost:7001' };`,
    );

    const opts = await run(['--config', config]);

    expect(opts.target).toBe('http://localhost:7001');
  });
});
