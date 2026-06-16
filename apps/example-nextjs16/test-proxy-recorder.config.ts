import { defineConfig } from 'test-proxy-recorder';

// Auto-discovered by the `test-proxy-recorder` CLI from the working directory.
// Equivalent to the old flags (`http://localhost:3002 -p 8100 -d ./e2e/recordings`),
// plus an extra redacted header to demonstrate the redaction config end-to-end.
export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  // Redaction is opt-in — a config object (even `{}`) enables it; omit it or
  // pass `false` to disable.
  redaction: {
    // Authorization / Cookie / Set-Cookie are always redacted; add an app header.
    headers: ['x-api-key'],
    // Scrub tokens embedded in request/response bodies (e.g. the /secret route).
    bodyPatterns: [/sk_live_\w+/g],
  },
});
