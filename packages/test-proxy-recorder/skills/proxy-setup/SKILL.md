---
name: proxy-setup
description: >
  Set up test-proxy-recorder for any Playwright project. Covers the proxy CLI
  (test-proxy-recorder <target> --port --dir), package.json scripts for the
  three-service architecture (UI app → proxy → backend API), playwright.config.ts
  webServer block pointing to /__control, per-test fixtures using
  playwrightProxy.before(page, testInfo, mode, { url }), HAR browser-side
  recording via url pattern, .mock.json server-side recording, record/replay/
  transparent modes, the record-once→commit→CI-replay lifecycle, and parallel
  test execution with fullyParallel. Load this skill when installing
  test-proxy-recorder, writing Playwright fixtures, or configuring record/replay.
type: core
library: test-proxy-recorder
library_version: "0.3.5"
sources:
  - "asmyshlyaev177/test-proxy-recorder:README.md"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/playwright/index.ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/types.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-nextjs16/package.json"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-extension/e2e/fixtures.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-extension/playwright.config.ts"
---

# test-proxy-recorder — Proxy Setup

`test-proxy-recorder` runs an HTTP proxy that records real API responses to
disk (`.mock.json` for server-side, `.har` for browser-side) and replays them
in Playwright tests without a live backend.

Two recording mechanisms work independently or together:

| Mechanism | File | Records |
|---|---|---|
| Proxy | `.mock.json` | Server-side (SSR) fetches from Node.js |
| HAR | `.har` | Browser-side `fetch` calls, Chrome extension traffic |

## Setup

### Browser-only / SPA / Chrome extension

No backend proxy needed for recording — only the proxy process for session
management via `/__control`.

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
```

```typescript
// e2e/fixtures.ts
import { test as base, type Page } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /api\.example\.com/;

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
export { expect } from '@playwright/test';
```

### Full-stack (SSR + browser)

The app's API base URL must be pointed at the proxy, not the real backend.

```json
// package.json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:3002 --port 8100 --dir ./e2e/recordings",
    "start:all": "concurrently \"pnpm proxy\" \"INTERNAL_API_URL=http://localhost:8100 pnpm start\"",
    "test:e2e": "pnpm build && concurrently --kill-others --success first --names services,tests \"pnpm start:all\" \"wait-on http://127.0.0.1:3000 http://127.0.0.1:8100/__control && playwright test --retries 1\"",
    "test:e2e:record": "pnpm build && playwright test --workers 1 --ui"
  }
}
```

`INTERNAL_API_URL` stands in for whatever env var your app reads its API base
URL from — it must point at the proxy (see Common Mistakes). For Next.js apps
running a production build, also set `TEST_PROXY_RECORDER_ENABLED=true`
(see test-proxy-recorder/nextjs-ssr).

```typescript
// e2e/my.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

// External services the browser calls directly (auth, CDN, analytics, etc.).
// Server-side fetches through the proxy are recorded automatically via .mock.json.
const CLIENT_SIDE_URL = /cognito-.*\.amazonaws\.com|\.s3\..*\.amazonaws\.com/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, {
    url: CLIENT_SIDE_URL,
  });
});

test('creates a todo', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-todo-input').fill('Buy groceries');
  await page.getByTestId('add-btn').click();
  await expect(page.getByTestId('todo-text').first()).toHaveText('Buy groceries');
});
```

## Core Patterns

### Record/replay lifecycle

Recording is manual, done once per test with a single worker. Replay runs on
CI with multiple workers, headlessly.

```bash
# 1. In fixtures.ts (or test file): set MODE = 'record'
# 2. Run once against the real backend, headed, one worker
npx playwright test --workers 1 --ui

# 3. Set MODE back to 'replay', commit recordings
git add e2e/recordings/
git commit -m "add e2e recordings"

# 4. Replay on CI — headless, parallel workers, no backend needed
npx playwright test
```

Recording files must be committed — do not add `e2e/recordings/` to
`.gitignore`. Optionally collapse diffs with:

```text
# .gitattributes
/e2e/recordings/** binary
```

### Auth setup

Auth always runs against the real auth provider — never recorded or replayed.
Use `setProxyMode('transparent')` so auth requests bypass the proxy entirely.
Skip the auth step in replay mode (the recorded session is already embedded in
the HAR / storage state file from the previous record run).

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

const AUTH_FILE = 'e2e/.auth/state.json';

const TEST_USER = {
  email: 'testuser@example.com',
  password: 'TestPassword123',
};

setup('authenticate', async ({ page }) => {
  // Bypass the proxy — auth must always hit the real provider.
  await setProxyMode('transparent');

  await page.goto('/users/sign-in');
  await page.getByTestId('email').fill(TEST_USER.email);
  await page.getByTestId('password').fill(TEST_USER.password);
  await page.getByTestId('signinButton').click();
  await page.waitForURL('/', { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
```

Add the auth state file to `.gitignore` — it contains session tokens and must not be committed:

```gitignore
# .gitignore
e2e/.auth/
```

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'e2e',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/state.json' },
    },
  ],
});
```

Include the auth provider domain in `CLIENT_SIDE_URL` when the browser makes
direct calls to it (e.g. Cognito token refresh, OAuth redirects):

```typescript
// These browser-to-Cognito calls are recorded in the HAR, not via the proxy.
const CLIENT_SIDE_URL = /cognito-.*\.amazonaws\.com/;
```

### Global teardown

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown().catch((err) => console.warn('teardown', err));
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

### playwrightProxy.before() signature

```typescript
await playwrightProxy.before(
  page,       // Playwright Page
  testInfo,   // TestInfo from test function argument
  mode,       // 'record' | 'replay' | 'transparent'
  {
    url,      // RegExp | string — browser-side requests to intercept via HAR
    timeout,  // ms — auto-reset timeout (default: 120000)
  }
);
```

`url` is optional. Omit it for proxy-only (SSR) recording with no browser-side
HAR interception.

### Session file naming

Session IDs are derived from the test file path and title:

```
jobs/Create.spec.ts + 'create a job'  →  jobs/Create__create-a-job
location.test.ts   + 'homepage loads' →  location__homepage-loads
```

Files on disk:
```
e2e/recordings/
  jobs/Create__create-a-job.mock.json   # server-side
  jobs__Create__create-a-job.har        # browser-side (/ replaced with __)
```

### Control endpoint

```bash
# Check current proxy state
curl http://localhost:8100/__control

# Programmatically switch mode
curl -X POST http://localhost:8100/__control \
  -H 'Content-Type: application/json' \
  -d '{"mode": "record", "id": "my-test"}'
```

Override the default port (8100) with `TEST_PROXY_RECORDER_PORT` env var.

## Common Mistakes

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

The app's API base URL must point at the proxy, not the real backend. When
omitted, requests bypass the proxy entirely and nothing is recorded.

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

`url` must match the external domains the browser calls directly — not the
proxy. Server-side fetches through the proxy are already recorded to
`.mock.json` automatically. `url` is only for browser-side HAR recording of
requests that never touch the proxy (third-party services, CDNs, auth providers).

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

`teardown()` sets the **global** proxy mode to `transparent`. With
`fullyParallel: true`, a fast test's `afterAll` fires while other tests are
still replaying, switching the proxy mid-session and routing requests to the
real network.

Source: README.md — Parallel Replay section

---

### HIGH webServer url points to proxy root not /__control

Wrong:
```typescript
webServer: {
  command: 'test-proxy-recorder http://localhost:8000 --port 8100',
  url: 'http://localhost:8100',  // root proxies to backend — may 502
}
```

Correct:
```typescript
webServer: {
  command: 'test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings',
  url: 'http://localhost:8100/__control',
}
```

Playwright uses `url` to health-check that the server is ready. The proxy root
`/` forwards to the backend, which may be unavailable, causing Playwright to
report the server as not ready. `/__control` is always available.

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
/e2e/recordings/** binary
```

CI has no recordings to replay from if the directory is gitignored. Tests will
fail or hit the real network.

Source: README.md — Switch to replay and commit

---

### MEDIUM Recording with Next.js dev server produces flaky recordings

Wrong:
```bash
# Recording against the dev server (MODE = 'record' in fixtures)
next dev & npx playwright test --workers 1
```

Correct:
```bash
# Build first, then record against the production build
pnpm build && npx playwright test --workers 1 --ui
```

The Next.js dev server is slow and can cause SSR fetches to timeout or execute
out of order, producing incomplete recordings that fail in replay.

Source: README.md — Full-stack Quick Start note; apps/example-nextjs16/package.json

---

### MEDIUM Recording with multiple workers corrupts session files

Wrong:
```typescript
// fixtures.ts — MODE set to 'record', running with default workers
const MODE = 'record' as const;
// playwright test  ← parallel workers write to same session files
```

Correct:
```typescript
// fixtures.ts
const MODE = 'record' as const;
// npx playwright test --workers 1 --ui  ← single worker when recording
```

Recording is a manual, single-worker operation. Replay is what uses multiple
workers (`fullyParallel: true`). Set `MODE = 'record'` in the fixture file, then set it back to `'replay'` before committing.

Source: apps/example-nextjs16/package.json; maintainer guidance

See also: test-proxy-recorder/nextjs-ssr — for Next.js SSR header propagation
