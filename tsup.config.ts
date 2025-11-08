import { defineConfig } from 'tsup';

export default defineConfig([
  // Library exports - dual format (ESM + CJS)
  {
    entry: {
      index: 'src/index.ts',
      'playwright/index': 'src/playwright/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    platform: 'node',
    external: [
      // Node.js built-ins
      /^node:/,
      'events',
      'http',
      'https',
      'net',
      'tls',
      'url',
      'zlib',
      'stream',
      'util',
      'buffer',
      'crypto',
      'fs',
      'path',
      // Dependencies
      'commander',
      'http-proxy',
      'ws',
      '@playwright/test',
    ],
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.cjs',
      };
    },
  },
  // CLI binary - ESM only (has top-level await)
  {
    entry: {
      proxy: 'src/proxy.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    platform: 'node',
    external: [
      // Node.js built-ins
      /^node:/,
      'events',
      'http',
      'https',
      'net',
      'tls',
      'url',
      'zlib',
      'stream',
      'util',
      'buffer',
      'crypto',
      'fs',
      'path',
      // Dependencies
      'commander',
      'http-proxy',
      'ws',
      '@playwright/test',
    ],
    outExtension({ format }) {
      return {
        js: '.js',
      };
    },
  },
]);
