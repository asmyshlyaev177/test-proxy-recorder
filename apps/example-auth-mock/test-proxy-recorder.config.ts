import { defineConfig } from 'test-proxy-recorder';

// Auto-discovered by the `test-proxy-recorder` CLI from the working directory.
export default defineConfig({
  target: 'http://localhost:3102',
  port: 8100,
  recordingsDir: './e2e/recordings',
  // Redaction is on by default: Authorization / Cookie / Set-Cookie are always
  // redacted, which is what scrubs the session token + cookie the authenticated
  // requests carry. This empty object is redundant; kept explicit for the example.
  redaction: {},
});
