import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from './config-loader.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'tpr-config-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(filename: string, contents: string): string {
  const filePath = path.join(dir, filename);
  writeFileSync(filePath, contents);
  return filePath;
}

describe('loadConfig', () => {
  it('returns null when no config file exists', async () => {
    await expect(loadConfig(undefined, dir)).resolves.toBeNull();
  });

  it('auto-discovers a .ts config in the given directory', async () => {
    writeConfig(
      'test-proxy-recorder.config.ts',
      `import { defineConfig } from '${path.resolve('src/config.ts')}';
       export default defineConfig({ target: 'http://localhost:3000', port: 9000 });`,
    );

    const config = await loadConfig(undefined, dir);

    expect(config).toMatchObject({
      target: 'http://localhost:3000',
      port: 9000,
    });
  });

  it('loads regex body patterns from a .ts config', async () => {
    writeConfig(
      'test-proxy-recorder.config.ts',
      String.raw`export default { redaction: { bodyPatterns: [/sk_live_\w+/g] } };`,
    );

    const config = await loadConfig(undefined, dir);
    const redaction = config?.redaction;
    const patterns = (redaction && redaction.bodyPatterns) || [];

    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toBeInstanceOf(RegExp);
  });

  it('loads an explicit config path', async () => {
    const filePath = writeConfig(
      'custom.config.mjs',
      `export default { port: 4321 };`,
    );

    const config = await loadConfig(filePath, dir);

    expect(config?.port).toBe(4321);
  });

  it('throws when an explicit config path does not exist', async () => {
    await expect(
      loadConfig(path.join(dir, 'missing.config.ts'), dir),
    ).rejects.toThrow(/Config file not found/);
  });

  it('throws when the config does not export an object', async () => {
    writeConfig('test-proxy-recorder.config.mjs', `export default 42;`);

    await expect(loadConfig(undefined, dir)).rejects.toThrow(
      /must export a config object/,
    );
  });
});
