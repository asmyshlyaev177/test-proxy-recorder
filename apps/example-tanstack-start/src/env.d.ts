/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for API calls from the browser. Baked in at build time.
   * Dev/test: the proxy (http://localhost:8100) so browser requests are recorded.
   * Production: the real backend URL.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
