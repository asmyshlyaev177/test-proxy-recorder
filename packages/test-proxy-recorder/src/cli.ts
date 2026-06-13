#!/usr/bin/env node

import path from 'node:path';

import { Command } from 'commander';

import { DEFAULT_TIMEOUT_MS } from './constants.js';
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
  redaction: RedactionConfig;
}

export function parseCliArgs(): CliOptions {
  const program = new Command();

  program
    .name('dev-proxy')
    .description(
      'Development proxy server with recording and replay capabilities',
    )
    .argument(
      '<target>',
      'Target API service URL (e.g., http://localhost:3000)',
    )
    .option(
      '-p, --port <number>',
      'Port number for the proxy server',
      String(DEFAULT_PORT),
    )
    .option(
      '-d, --dir <path>',
      'Directory to store recordings (relative to CWD)',
      DEFAULT_RECORDINGS_DIR,
    )
    .option(
      '-t, --timeout <ms>',
      'Session timeout in milliseconds',
      String(DEFAULT_TIMEOUT_MS),
    )
    .option(
      '--no-redact',
      'Disable secret redaction (commit raw Authorization/Cookie headers — not recommended)',
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
    .action(() => {
      // Action handled after parse
    });

  program.parse();

  const target = program.args[0];
  const options = program.opts<{
    port: string;
    dir: string;
    timeout: string;
    redact: boolean;
    redactHeaders?: string;
    redactBody?: string;
    allowHeaders?: string;
    allowCookies?: string;
  }>();

  const port = Number.parseInt(options.port, 10);
  if (Number.isNaN(port) || port < 1025 || port > 65_535) {
    console.error('Error: Invalid port number. Must be between 1 and 65535');
    process.exit(1);
  }

  const timeout = Number.parseInt(options.timeout, 10);
  if (Number.isNaN(timeout) || timeout < 0) {
    console.error('Error: Invalid timeout. Must be a non-negative number');
    process.exit(1);
  }

  if (!target) {
    program.help();
  }

  // Resolve recordings directory relative to the current working directory (where the command is run)
  const recordingsDir = path.resolve(process.cwd(), options.dir);

  // commander maps --no-redact to redact: false; default is true (enabled)
  const redaction: RedactionConfig = {
    enabled: options.redact !== false,
    headers: splitList(options.redactHeaders),
    bodyPatterns: splitList(options.redactBody),
    allowHeaders: splitList(options.allowHeaders),
    allowCookies: splitList(options.allowCookies),
  };

  return { target, port, recordingsDir, timeout, redaction };
}
