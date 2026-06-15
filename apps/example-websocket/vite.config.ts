import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Keep the demo bundle tiny and readable.
    target: 'es2022',
  },
});
