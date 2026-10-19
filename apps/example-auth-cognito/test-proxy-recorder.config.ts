import { defineConfig } from 'test-proxy-recorder';

// Auto-discovered by the `test-proxy-recorder` CLI from the working directory.
export default defineConfig({
  target: `http://localhost:${process.env.MOCK_BACKEND_PORT || 3202}`,
  port: 8100,
  recordingsDir: './e2e/recordings',
  // Authorization / Cookie / Set-Cookie are always redacted — that's what scrubs
  // the Cognito JWT the authenticated requests carry.
  redaction: {},
});
