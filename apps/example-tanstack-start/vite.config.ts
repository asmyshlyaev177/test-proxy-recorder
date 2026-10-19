import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Same default as the dev script's --port, for a bare `vite dev`.
    port: Number(process.env.APP_PORT || 3000),
  },
  // The `~/*` path alias (tsconfig.json `paths`) is resolved by the tanstackStart
  // plugin, which reads the project's tsconfig — no extra Vite config needed.
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
  ],
});
