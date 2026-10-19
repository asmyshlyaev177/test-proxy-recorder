import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.test.ts'],
    // Spawns real CLI processes and a backend; give it room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One file at a time: several build or pack the library into the same dist/
    // when it is missing, and parallel builds would race on it.
    fileParallelism: false,
  },
});
