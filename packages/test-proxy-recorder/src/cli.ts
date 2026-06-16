#!/usr/bin/env node

import path from 'node:path';

import { Command } from 'commander';

import type { Config } from './config.js';
import { loadConfig } from './config-loader.js';
import { DEFAULT_TIMEOUT_MS } from './constants.js';
import type { WebSocketReplayConfig } from './types.js';
import type { RedactionConfig } from './utils/redact.js';

const DEFAULT_PORT = 8000;
const DEFAULT_RECORDINGS_DIR = './recordings';

/** Parse a comma-separated CLI option into a trimmed, non-empty list. */
function splitList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface CliOptions {
  target: string;
  port: number;
  recordingsDir: string;
  timeout: number;
  redaction: RedactionConfig | false;
  websocket: WebSocketReplayConfig;
}

interface RawOptions {
  config?: string;
  port?: string;
  dir?: string;
  timeout?: string;
  redact?: boolean;
  redactHeaders?: string;
  redactBody?: string;
  allowHeaders?: string;
  allowCookies?: string;
  wsTiming?: string;
}

/**
 * Resolve a numeric option from the CLI (string), config file (number), then a
 * built-in default. Exits the process with `errorMessage` when the resolved
 * value fails `isValid`.
 */
function resolveNumber(
  cliValue: string | undefined,
  configValue: number | undefined,
  defaultValue: number,
  isValid: (n: number) => boolean,
  errorMessage: string,
): number {
  const value =
    cliValue !== undefined
      ? Number.parseInt(cliValue, 10)
      : (configValue ?? defaultValue);
  if (Number.isNaN(value) || !isValid(value)) {
    console.error(errorMessage);
    process.exit(1);
  }
  return value;
}

/**
 * Resolve redaction with CLI-flag-over-config precedence. Redaction is opt-in:
 * it's on when any redaction flag is passed (`--redact` / `--redact-*` /
 * `--allow-*`) or the config provides a redaction object; otherwise (config
 * `false` or omitted, no flags) it's off and this returns `false`.
 */
function resolveRedaction(
  options: RawOptions,
  configRedaction: RedactionConfig | false | undefined,
): RedactionConfig | false {
  const cliProvided =
    options.redact === true ||
    options.redactHeaders !== undefined ||
    options.redactBody !== undefined ||
    options.allowHeaders !== undefined ||
    options.allowCookies !== undefined;

  // Config object (even `{}`) enables; `false`/`undefined` does not.
  const configEnabled = !!configRedaction;
  if (!cliProvided && !configEnabled) {
    return false;
  }

  const base: RedactionConfig = configRedaction || {};
  return {
    headers:
      options.redactHeaders !== undefined
        ? splitList(options.redactHeaders)
        : (base.headers ?? []),
    bodyPatterns:
      options.redactBody !== undefined
        ? splitList(options.redactBody)
        : (base.bodyPatterns ?? []),
    allowHeaders:
      options.allowHeaders !== undefined
        ? splitList(options.allowHeaders)
        : (base.allowHeaders ?? []),
    allowCookies:
      options.allowCookies !== undefined
        ? splitList(options.allowCookies)
        : (base.allowCookies ?? []),
    placeholder: base.placeholder,
  };
}

/** Merge WebSocket replay settings with CLI-flag-over-config-over-default precedence. */
function resolveWebSocket(
  options: RawOptions,
  configWebSocket: WebSocketReplayConfig | undefined,
): WebSocketReplayConfig {
  const timing = options.wsTiming ?? configWebSocket?.timing ?? 'burst';
  if (timing !== 'burst' && timing !== 'original') {
    console.error("Error: --ws-timing must be 'burst' or 'original'");
    process.exit(1);
  }

  return { timing };
}

export async function parseCliArgs(argv?: string[]): Promise<CliOptions> {
  const program = new Command();

  program
    .name('test-proxy-recorder')
    .description(
      'Development proxy server with recording and replay capabilities',
    )
    .argument(
      '[target]',
      'Target API service URL (e.g., http://localhost:3000). Overrides `target` from the config file.',
    )
    .option(
      '-c, --config <path>',
      'Path to a config file (default: auto-detect test-proxy-recorder.config.{ts,js,mjs} in the current directory)',
    )
    .option('-p, --port <number>', 'Port number for the proxy server')
    .option(
      '-d, --dir <path>',
      'Directory to store recordings (relative to CWD)',
    )
    .option('-t, --timeout <ms>', 'Session timeout in milliseconds')
    .option(
      '--redact',
      'Enable secret redaction (off by default) — strip Authorization/Cookie/Set-Cookie before writing recordings',
    )
    .option(
      '--redact-headers <names>',
      'Comma-separated extra header names to redact (merged with the defaults)',
    )
    .option(
      '--redact-body <patterns>',
      'Comma-separated regex patterns to redact from request/response bodies',
    )
    .option(
      '--allow-headers <names>',
      'Comma-separated header names to exempt from redaction',
    )
    .option(
      '--allow-cookies <names>',
      'Comma-separated cookie names to keep unredacted inside Cookie/Set-Cookie',
    )
    .option(
      '--ws-timing <mode>',
      "WebSocket replay pacing: 'burst' (default, immediate) or 'original' (re-paced from recorded timestamps)",
    );

  program.parse(argv);

  const options = program.opts<RawOptions>();

  let config: Config | null;
  try {
    config = await loadConfig(options.config);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  // Precedence for every option: CLI flag > config file > built-in default.
  const target = program.args[0] ?? config?.target;
  if (!target) {
    console.error(
      'Error: target is required. Pass it as an argument or set `target` in the config file.',
    );
    program.help();
  }

  const port = resolveNumber(
    options.port,
    config?.port,
    DEFAULT_PORT,
    (n) => n >= 1025 && n <= 65_535,
    'Error: Invalid port number. Must be between 1025 and 65535',
  );

  const timeout = resolveNumber(
    options.timeout,
    config?.timeout,
    DEFAULT_TIMEOUT_MS,
    (n) => n >= 0,
    'Error: Invalid timeout. Must be a non-negative number',
  );

  // Resolve recordings directory relative to the current working directory (where the command is run)
  const dir = options.dir ?? config?.recordingsDir ?? DEFAULT_RECORDINGS_DIR;
  const recordingsDir = path.resolve(process.cwd(), dir);

  const redaction = resolveRedaction(options, config?.redaction);
  const websocket = resolveWebSocket(options, config?.websocket);

  return { target, port, recordingsDir, timeout, redaction, websocket };
}
