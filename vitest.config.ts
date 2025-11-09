import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      include: ["src"],
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: "./coverage-reports",
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.integration.test.ts',
        'test-results/**',
        'tsup.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
      ],
    },
  },
});
