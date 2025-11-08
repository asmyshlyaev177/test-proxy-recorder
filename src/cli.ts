#!/usr/bin/env node

import path from 'node:path';

import { Command } from 'commander';

const DEFAULT_PORT = 8000;
const DEFAULT_RECORDINGS_DIR = './recordings';

export interface CliOptions {
  targets: string[];
  port: number;
  recordingsDir: string;
}

export function parseCliArgs(): CliOptions {
  const program = new Command();

  program
    .name('dev-proxy')
    .description(
      'Development proxy server with recording and replay capabilities',
    )
    .argument(
      '<targets...>',
      'Target API service URLs (e.g., http://localhost:3000)',
    )
    .option(
      '-p, --port <number>',
      'Port number for the proxy server',
      String(DEFAULT_PORT),
    )
    .option(
      '-r, --recordings-dir <path>',
      'Directory to store recordings (relative to CWD)',
      DEFAULT_RECORDINGS_DIR,
    )
    .action(() => {
      // Action handled after parse
    });

  program.parse();

  const targets = program.args;
  const options = program.opts<{ port: string; recordingsDir: string }>();

  const port = Number.parseInt(options.port, 10);
  if (Number.isNaN(port) || port < 1025 || port > 65_535) {
    console.error('Error: Invalid port number. Must be between 1 and 65535');
    process.exit(1);
  }

  if (targets.length === 0) {
    program.help();
  }

  // Resolve recordings directory relative to the current working directory (where the command is run)
  const recordingsDir = path.resolve(process.cwd(), options.recordingsDir);

  return { targets, port, recordingsDir };
}
