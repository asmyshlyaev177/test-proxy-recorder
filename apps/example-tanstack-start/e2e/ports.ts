// Seeding and reset calls go straight to the mock backend, never through the proxy.
export const MOCK_BACKEND_URL = `http://localhost:${process.env.MOCK_BACKEND_PORT || 3002}`;

// The port playwrightProxy reads too, so the suite can run beside another proxy on 8100.
const PROXY_PORT = Number(process.env.TEST_PROXY_RECORDER_PORT || 8100);

export const PROXY_URL_PATTERN = new RegExp(`localhost:${PROXY_PORT}\\b`);

// The env port outranks the config file's, and these proxies must bind the port their test chose.
export function envWithoutProxyPort(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.TEST_PROXY_RECORDER_PORT;
  return env;
}
