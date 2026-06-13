import { existsSync } from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';

import type { Config } from './config.js';

const CONFIG_BASENAME = 'test-proxy-recorder.config';
const CONFIG_EXTENSIONS = ['ts', 'mts', 'js', 'mjs', 'cjs'] as const;

/** Return the first existing config file in `cwd`, or null when none exists. */
function findConfigFile(cwd: string): string | null {
  for (const ext of CONFIG_EXTENSIONS) {
    const candidate = path.join(cwd, `${CONFIG_BASENAME}.${ext}`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Load a config file. When `explicitPath` is given it must exist; otherwise the
 * file is auto-discovered in `cwd`. Returns null when no config file is found.
 * `.ts`/`.js`/`.mjs`/`.cjs` are all supported via jiti.
 */
export async function loadConfig(
  explicitPath?: string,
  cwd: string = process.cwd(),
): Promise<Config | null> {
  let filePath: string | null;
  if (explicitPath) {
    filePath = path.resolve(cwd, explicitPath);
    if (!existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }
  } else {
    filePath = findConfigFile(cwd);
  }

  if (!filePath) {
    return null;
  }

  const jiti = createJiti(import.meta.url);
  const config = await jiti.import<Config>(filePath, { default: true });

  if (typeof config !== 'object' || config === null) {
    throw new Error(
      `Config file ${filePath} must export a config object ` +
        '(use `export default defineConfig({ ... })`)',
    );
  }

  return config;
}
