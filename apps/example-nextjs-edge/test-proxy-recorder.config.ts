import { defineConfig } from 'test-proxy-recorder';

// Auto-discovered by the `test-proxy-recorder` CLI from the working directory.
// Distinct ports from the other examples so they can run side by side.
export default defineConfig({
  target: 'http://localhost:3012',
  port: 8110,
  recordingsDir: './e2e/recordings',
});
