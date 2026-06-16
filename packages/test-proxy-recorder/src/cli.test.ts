import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

    expect(opts.port).toBe(8000);
    expect(opts.recordingsDir).toBe(
      path.resolve(process.cwd(), './recordings'),
    );
    expect(opts.timeout).toBe(120_000);
    // Redaction is opt-in — off (false) unless a config object or a flag enables it.
    expect(opts.redaction).toBe(false);
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
