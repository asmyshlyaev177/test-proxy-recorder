import type { WebSocketReplayConfig } from './types.js';
import type { RedactionConfig } from './utils/redact.js';

/**
 * Shape of a `test-proxy-recorder.config.{ts,js,mjs}` file. Every field is
 * optional; any value passed as a CLI flag overrides the matching config value.
 */
export interface Config {
  /** Target API service URL, e.g. `http://localhost:3000`. */
  target?: string;
  /** Port for the proxy server. */
  port?: number;
  /** Directory to store recordings, resolved relative to CWD. */
  recordingsDir?: string;
  /** Session timeout in milliseconds. */
  timeout?: number;
  /**
   * Secret redaction. **On by default** — the Authorization/Cookie/Set-Cookie
   * headers are stripped from recordings unless you turn it off. Pass a config
   * object to customize what gets redacted, or `false` to disable it entirely.
   * See {@link RedactionConfig}.
   */
  redaction?: RedactionConfig | false;
  /** WebSocket replay pacing. See {@link WebSocketReplayConfig}. */
  websocket?: WebSocketReplayConfig;
}

/**
 * Identity helper for config files. Wrapping the object gives type-checking and
 * editor autocomplete without changing its value:
 *
 * ```ts
 * // test-proxy-recorder.config.ts
 * import { defineConfig } from 'test-proxy-recorder';
 *
 * export default defineConfig({
 *   target: 'http://localhost:3000',
 *   redaction: { bodyPatterns: [/sk_live_\w+/g] },
 * });
 * ```
 */
export function defineConfig(config: Config): Config {
  return config;
}
