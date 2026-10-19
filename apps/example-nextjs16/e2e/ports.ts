// Defaults match the package.json scripts; each service moves with its own env var.
const PROXY_PORT_ENV = 'TEST_PROXY_RECORDER_PORT';

export const MOCK_BACKEND_URL = `http://localhost:${process.env.MOCK_BACKEND_PORT || 3002}`;

// The port playwrightProxy reads too, so the suite can run beside another proxy on 8100.
const PROXY_PORT = Number(process.env[PROXY_PORT_ENV] || 8100);

// Browser calls to the proxy, recorded to the HAR alongside the server-side .mock.json.
export const PROXY_URL_PATTERN = new RegExp(`localhost:${PROXY_PORT}\\b`);

// The env port outranks the config file's, and these proxies must bind the port their test chose.
export function envWithoutProxyPort(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env[PROXY_PORT_ENV];
  return env;
}
