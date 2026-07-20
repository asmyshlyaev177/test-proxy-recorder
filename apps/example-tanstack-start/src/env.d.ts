/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for API calls from the browser. Baked in at build time.
   * Dev/test: the proxy (http://localhost:8100) so browser requests are recorded.
   * Production: the real backend URL.
   */
  readonly VITE_API_URL?: string;
  /**
   * Public AWS Cognito config for the authenticated dashboard (/login →
   * /dashboard). Baked into the client bundle at build time; NOT secret. The
   * test-user credentials, by contrast, are secret and live in the Playwright
   * process env (`.env.local` / CI secrets), never in the bundle.
   */
  readonly VITE_COGNITO_REGION?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
