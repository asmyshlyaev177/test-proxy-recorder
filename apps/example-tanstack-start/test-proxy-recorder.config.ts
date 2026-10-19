import { defineConfig } from 'test-proxy-recorder';

// Auto-discovered by the `test-proxy-recorder` CLI from the working directory.
// Proxies to the mock backend on MOCK_BACKEND_PORT (3002), listens on :8100 unless
// TEST_PROXY_RECORDER_PORT overrides it, and writes recordings to ./e2e/recordings
// — plus an extra redacted header to demonstrate the redaction config end-to-end.
export default defineConfig({
  target: `http://localhost:${process.env.MOCK_BACKEND_PORT || 3002}`,
  port: 8100,
  recordingsDir: './e2e/recordings',
  // Redaction is on by default; this object customizes it. Pass `false` to disable.
  redaction: {
    // Authorization / Cookie / Set-Cookie are always redacted; add an app header.
    headers: ['x-api-key'],
    // Scrub tokens embedded in request/response bodies (e.g. the /secret route).
    bodyPatterns: [/sk_live_\w+/g],
  },
});
