import { Command } from 'commander';

import { loadConfig } from './config-loader.js';
import { CONTROL_ENDPOINT } from './constants.js';
import { Modes } from './types.js';

/** Fallback port, matching the proxy's own default in {@link parseCliArgs}. */
const DEFAULT_PORT = 8000;
const MIN_PORT = 1025;
const MAX_PORT = 65_535;

interface ResetRawOptions {
  config?: string;
  port?: string;
}

/**
 * Resolve the port to reset, with **flag > env > config > default** precedence.
 * This mirrors how the proxy itself picks its port (CLI flag over config over
 * default), plus the documented `TEST_PROXY_RECORDER_PORT` override, so `reset`
 * targets whatever the running proxy is actually listening on.
 *
 * @throws when the resolved value is not a valid port.
 */
export function resolveResetPort(opts: {
  cliPort?: string;
  envPort?: string;
  configPort?: number;
}): number {
  const { cliPort, envPort, configPort } = opts;

  let value: number;
  if (cliPort !== undefined) {
    value = Number.parseInt(cliPort, 10);
  } else if (envPort !== undefined && envPort !== '') {
    value = Number.parseInt(envPort, 10);
  } else {
    value = configPort ?? DEFAULT_PORT;
  }

  if (Number.isNaN(value) || value < MIN_PORT || value > MAX_PORT) {
    throw new Error(
      `Invalid port number. Must be between ${MIN_PORT} and ${MAX_PORT}`,
    );
  }
  return value;
}

export interface ResetResult {
  /** Whether the command should be considered successful (exit 0). */
  ok: boolean;
  /** Set when the proxy could not be reached — treated as a no-op success. */
  unreachable?: boolean;
  /** Resulting proxy mode reported by the control endpoint. */
  mode?: string;
  /** Human-readable line to print. */
  message: string;
}

/**
 * POST `{ mode: 'transparent' }` to a running proxy's control endpoint — the
 * same thing {@link playwrightProxy.teardown} does, over HTTP. An unreachable
 * proxy is reported as a no-op success: there is nothing to reset.
 */
export async function runReset(port: number): Promise<ResetResult> {
  const url = `http://localhost:${port}${CONTROL_ENDPOINT}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: Modes.transparent }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        message: `Proxy on port ${port} returned ${response.status}: ${text}`,
      };
    }

    const data = (await response.json()) as { mode?: string };
    const mode = data.mode ?? Modes.transparent;
    return {
      ok: true,
      mode,
      message: `Proxy on port ${port} reset to ${mode} mode.`,
    };
  } catch (error) {
    // A connection error means no proxy is running on that port — nothing to
    // reset. Report it as success so the command is safe to run in scripts.
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: true,
      unreachable: true,
      message: `No proxy reachable on port ${port} — nothing to reset (${reason}).`,
    };
  }
}

/**
 * Entry point for the `reset` subcommand. Resolves the target port from flags /
 * env / config, resets the proxy to transparent mode, and returns the process
 * exit code. `argv` is the raw process argv with the leading node, script, and
 * `reset` token already removed by the caller.
 */
export async function resetCommand(
  argv: string[],
  cwd: string = process.cwd(),
): Promise<number> {
  const program = new Command();

  program
    .name('test-proxy-recorder reset')
    .description('Reset a running proxy back to transparent mode')
    .option(
      '-p, --port <number>',
      'Proxy port (default: TEST_PROXY_RECORDER_PORT env, then the config file, then 8000)',
    )
    .option(
      '-c, --config <path>',
      'Path to a config file used to discover the port (default: auto-detect)',
    )
    .allowExcessArguments(false);

  program.parse(argv, { from: 'user' });
  const opts = program.opts<ResetRawOptions>();

  let configPort: number | undefined;
  try {
    const config = await loadConfig(opts.config, cwd);
    configPort = config?.port;
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  let port: number;
  try {
    port = resolveResetPort({
      cliPort: opts.port,
      envPort: process.env.TEST_PROXY_RECORDER_PORT,
      configPort,
    });
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const result = await runReset(port);
  if (result.ok) {
    console.log(result.message);
    return 0;
  }
  console.error(result.message);
  return 1;
}
