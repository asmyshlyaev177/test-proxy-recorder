import { defineConfig } from 'vite';

const appPort = Number(process.env.APP_PORT || 4173);
const proxyPort = process.env.TEST_PROXY_RECORDER_PORT || '8100';
const PROXIED_WS_URL = `ws://localhost:${proxyPort}/ws/btcusdt@ticker`;

export default defineConfig(({ mode }) => {
  // `--mode test` aims the build at the proxy unless VITE_WS_URL says otherwise;
  // a plain build keeps main.ts's default and talks straight to Binance.
  const isProxiedBuild = mode === 'test' && !process.env.VITE_WS_URL;
  return {
    build: {
      // Keep the demo bundle tiny and readable.
      target: 'es2022',
    },
    define: isProxiedBuild
      ? { 'import.meta.env.VITE_WS_URL': JSON.stringify(PROXIED_WS_URL) }
      : {},
    preview: { port: appPort, strictPort: true },
  };
});
