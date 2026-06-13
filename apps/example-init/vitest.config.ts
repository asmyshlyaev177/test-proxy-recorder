import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.test.ts'],
    // Spawns real CLI processes and a backend; give it room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One stack (proxy + backend) at a time — tests share fixed ports.
    fileParallelism: false,
  },
});
