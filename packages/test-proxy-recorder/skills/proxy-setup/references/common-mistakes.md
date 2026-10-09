# test-proxy-recorder — Common Mistakes

Failure modes when setting up record/replay, each with the wrong vs. correct pattern. Loaded on demand from the `proxy-setup` skill.

### CRITICAL App env var not redirected through proxy

Wrong:
```json
{
  "scripts": {
    "dev:proxy": "concurrently \"pnpm proxy\" \"pnpm dev\""
  }
}
```

Correct:
```json
{
  "scripts": {
    "dev:proxy": "concurrently \"pnpm proxy\" \"INTERNAL_API_URL=http://localhost:8100 pnpm dev\""
  }
}
```

The app's API base URL must point at the proxy, not the real backend. When omitted, requests bypass the proxy entirely and nothing is recorded.

Source: README.md — Full-stack Quick Start

---

### CRITICAL Wrong CLIENT_SIDE_URL pattern for HAR recording

Wrong:
```typescript
// Matches the proxy URL — but the proxy handles server-side recording
// automatically. This intercepts nothing useful for HAR.
await playwrightProxy.before(page, testInfo, MODE, {
  url: /localhost:8100/,
});
```

Correct:
```typescript
// Match the actual external domains the browser calls directly:
// third-party auth, CDN, analytics, chat SDKs, etc.
const CLIENT_SIDE_URL = /cognito-.*\.amazonaws\.com|\.stream-io-api\.com/;
await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });

// Browser-only / SPA with no SSR — match the real API domain
await playwrightProxy.before(page, testInfo, MODE, { url: /api\.example\.com/ });
```

`url` must match the external domains the browser calls directly — not the proxy. Server-side fetches through the proxy are already recorded to `.mock.json` automatically. `url` is only for browser-side HAR recording of requests that never touch the proxy (third-party services, CDNs, auth providers).

Source: README.md — Playwright Integration; apps/example-extension/e2e/fixtures.ts

---

### HIGH teardown() called per-test breaks parallel replay

Wrong:
```typescript
test.afterAll(async () => {
  await playwrightProxy.teardown(); // resets global proxy mode for all workers
});
```

Correct:
```typescript
// Omit afterAll entirely.
// Session cleanup is automatic via context.on('close').
// Only call teardown() in globalTeardown (see Global Teardown pattern above).
```

`teardown()` sets the **global** proxy mode to `transparent`. With `fullyParallel: true`, a fast test's `afterAll` fires while other tests are still replaying, switching the proxy mid-session and routing requests to the real network.

Source: README.md — Parallel Replay section

---

### HIGH webServer url points to proxy root not /__control

Wrong:
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder http://localhost:8000 --port 8100',
    url: 'http://localhost:8100', // root proxies to backend — may 502
  },
});
```

Correct:
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
  },
});
```

Playwright uses `url` to health-check that the server is ready. The proxy root `/` forwards to the backend, which may be unavailable, causing Playwright to report the server as not ready. `/__control` is always available.

Source: README.md; apps/example-extension/playwright.config.ts

---

### HIGH Recording files added to .gitignore

Wrong:
```gitignore
# .gitignore
e2e/recordings/
```

Correct:
```gitignore
# .gitignore — do NOT list e2e/recordings/

# .gitattributes — collapse diffs without excluding files
/e2e/recordings/** linguist-generated=true
```

CI has no recordings to replay from if the directory is gitignored. Tests will fail or hit the real network.

Source: README.md — Switch to replay and commit

---

### MEDIUM Recording with Next.js dev server produces flaky recordings

Wrong:
```bash
# Recording against the dev server
next dev & RECORD_MODE=1 npx playwright test --workers 1
```

Correct:
```bash
# Build first, then record against the production build
pnpm build && RECORD_MODE=1 npx playwright test --workers 1
```

The Next.js dev server is slow and can cause SSR fetches to timeout or execute out of order, producing incomplete recordings that fail in replay. It can also reset a `registerProxyFetch` global-`fetch` patch between requests ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), so SSR fetches lose the session id — another reason to record against build+start.

Source: README.md — Full-stack Quick Start note; apps/example-nextjs16/package.json

---

### MEDIUM Recording with multiple workers corrupts session files

Wrong:
```bash
# Parallel workers write to the same session files
RECORD_MODE=1 npx playwright test
```

Correct:
```bash
# One worker while recording
RECORD_MODE=1 npx playwright test --workers 1
```

Recording is a single-worker operation. Replay is what uses multiple workers (`fullyParallel: true`), and it needs no flag: without `RECORD_MODE` the fixture replays.

Source: apps/example-nextjs16/package.json; maintainer guidance

---

### HIGH Separate backend, database or ports for tests

Wrong:
```typescript
// playwright.config.ts — a test-only API on its own database and port
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: [
    { command: 'pnpm --filter server start', env: { PORT: '3101', DB_PATH: 'e2e/test.db' }, url: 'http://localhost:3101/health' },
    { command: 'vite --port 5174', env: { API_URL: 'http://localhost:8100' }, url: 'http://localhost:5174' },
  ],
});
```

Correct:
```typescript
// playwright.config.ts — the dev proxy and backend; a production build under E2E_BUILD
import { defineConfig } from '@playwright/test';

const IS_BUILD = Boolean(process.env.E2E_BUILD);
const APP_URL = IS_BUILD ? 'http://localhost:4173' : 'http://localhost:5173';

export default defineConfig({
  use: { baseURL: APP_URL },
  webServer: [
    { command: 'test-proxy-recorder', url: 'http://localhost:8100/__control', reuseExistingServer: true },
    IS_BUILD
      ? { command: 'vite build && vite preview', env: { API_URL: 'http://localhost:8100' }, url: APP_URL }
      : {
          command: 'pnpm dev:app',
          url: APP_URL,
          reuseExistingServer: true,
          // pnpm --parallel runs each package in its own process group, which the
          // default SIGKILL leaves running on its port; on SIGTERM pnpm stops them.
          gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
        },
  ],
});
```

Tests run against the dev servers and database the user works with, so a failing test can be rerun by hand and its bug reproduced in the browser. Prepare data with the project's own seed script, run by hand before recording. A test-only stack also breaks the dev proxy: `target` points at a backend dev never starts.

Source: maintainer guidance
