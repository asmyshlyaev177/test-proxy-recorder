---
name: proxy-setup
description: >
  Set up test-proxy-recorder for any Playwright project. Covers the proxy CLI (test-proxy-recorder <target> --port --dir), package.json scripts for the three-service architecture (UI app → proxy → backend API), playwright.config.ts webServer block pointing to /__control, per-test fixtures using playwrightProxy.before(page, testInfo, mode, { url }), HAR browser-side recording via url pattern, .mock.json server-side recording, record/replay/ transparent modes, the record-once→commit→CI-replay lifecycle, automatic secret redaction of Authorization/Cookie/Set-Cookie headers (--no-redact, --redact-headers, --redact-body), an optional config file (test-proxy-recorder.config.ts via defineConfig, --config) with CLI-overrides- config precedence, and parallel test execution with fullyParallel. Load this skill when installing test-proxy-recorder, writing Playwright fixtures, or configuring record/replay.
sources:
  - "asmyshlyaev177/test-proxy-recorder:README.md"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/playwr\
    ight/index.ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/types.\
    ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/cli.ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/config\
    .ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/utils/\
    redact.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-nextjs16/package.json"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-extension/e2e/fixtures.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-extension/playwright.confi\
    g.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-auth-cognito/package.json"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-auth-cognito/e2e/setup-aut\
    h.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-auth-mock/package.json"
metadata:
  type: core
  library: test-proxy-recorder
  library_version: "1.4.0" # x-release-please-version
---

# test-proxy-recorder — Proxy Setup

`test-proxy-recorder` runs an HTTP proxy that records real API responses to disk (`.mock.json` for server-side, `.har` for browser-side) and replays them in Playwright tests without a live backend.

Two recording mechanisms work independently or together:

| Mechanism | File | Records |
|---|---|---|
| Proxy | `.mock.json` | Server-side (SSR) fetches from Node.js |
| HAR | `.har` | Browser-side `fetch` calls, Chrome extension traffic |

## Setup

With no test recording or replaying, the proxy is transparent: it forwards every request to `target` unchanged. Point `target` at the backend the app uses in dev and run dev through the proxy as usual (`init` wraps `dev` to do this).

Tests run against the same dev servers, backend and database you use by hand, so a failing test can be rerun and its bug reproduced in the browser. Don't start a separate backend or database for tests. The `test:e2e` scripts set `E2E_BUILD=1` to test a production build of the app, served on a port dev doesn't use and pointed at the proxy; a plain `playwright test` or `--ui` uses the dev server, to reproduce a failure by hand (`init` adds this switch when it finds a `preview` script or Next.js `start`). The proxy entry has `reuseExistingServer: true`, so a run uses the proxy `dev` runs and, through it, the dev backend: recording needs `dev` up, replay doesn't.

### Browser-only / SPA / Chrome extension

No backend proxy needed for recording — only the proxy process for session management via `/__control`.

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

// RECORD_MODE=1 hits the real API and rewrites the recordings; otherwise replay.
const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
export { expect } from '@playwright/test';
```

### SPA behind a dev-server proxy (Vite `server.proxy`)

When the browser calls a same-origin path such as `/api` and the dev server forwards it to the backend, point that forward at the recorder. Every API call then goes through the proxy and is recorded to `.mock.json`, so no HAR is needed. `playwrightProxy.before()` sets the `x-test-rcrd-id` session header on every page request, and the dev server passes it on to the recorder.

```typescript
// vite.config.ts — browser → Vite /api → recorder → backend
const apiTarget = process.env.API_URL ?? 'http://localhost:3001';
export default defineConfig({ server: { proxy: { '/api': apiTarget } } });
```

```json
// package.json — dev:app points Vite's /api forward at the recorder
{
  "scripts": {
    "dev": "concurrently --kill-others \"pnpm proxy\" \"pnpm dev:app\"",
    "dev:app": "API_URL=http://localhost:8100 vite",
    "test:e2e": "E2E_BUILD=1 playwright test",
    "test:e2e:record": "E2E_BUILD=1 RECORD_MODE=1 playwright test --workers 1"
  }
}
```

```typescript
// playwright.config.ts — a production build under E2E_BUILD, the dev server otherwise.
// `vite preview` forwards /api with server.proxy too.
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

In the fixture, call `playwrightProxy.before(page, testInfo, MODE)` without the `url` option. A `url` that matched `/api` would record the same calls a second time, in a HAR.

### Full-stack (SSR + browser)

The app's API base URL must be pointed at the proxy, not the real backend.

```json
// package.json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:3002 --port 8100 --dir ./e2e/recordings",
    "start:all": "concurrently \"pnpm proxy\" \"INTERNAL_API_URL=http://localhost:8100 pnpm start\"",
    "test:e2e": "pnpm build && concurrently --kill-others --success first --names services,tests \"pnpm start:all\" \"wait-on http://127.0.0.1:3000 http://127.0.0.1:8100/__control && playwright test --retries 1\"",
    "test:e2e:record": "pnpm build && RECORD_MODE=1 playwright test --workers 1"
  }
}
```

`concurrently` and `wait-on` are separate packages; install them as devDependencies before using these scripts.

`INTERNAL_API_URL` stands in for whatever env var your app reads its API base URL from — it must point at the proxy (see Common Mistakes). For Next.js apps running a production build, also set `TEST_PROXY_RECORDER_ENABLED=true` (see test-proxy-recorder/nextjs-ssr).

```typescript
// e2e/my.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// RECORD_MODE=1 hits the real API and rewrites the recordings; otherwise replay.
const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

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

Recording is manual, done once per test with a single worker. Replay runs on CI with multiple workers, headlessly.

The scripts below set env vars as `NAME=1 command`, which Windows cmd and PowerShell reject; WSL and Git Bash run them as they are. On cmd or PowerShell, prefix them with [`cross-env`](https://www.npmjs.com/package/cross-env): `cross-env RECORD_MODE=1 playwright test --workers 1`.

```bash
# 1. Seed the dev database if the tests need it, then record once against the
#    dev backend, one worker (add --ui to watch it)
RECORD_MODE=1 npx playwright test --workers 1

# 2. Commit the recordings
git add e2e/recordings/
git commit -m "add e2e recordings"

# 3. Replay on CI — headless, parallel workers, no backend needed
npx playwright test
```

Recording files must be committed — do not add `e2e/recordings/` to `.gitignore`. Optionally collapse diffs with:

```text
# .gitattributes
/e2e/recordings/** linguist-generated=true
```

A recording is only as repeatable as the backend state it was made against. Before recording, put the dev database in the state the tests expect with the project's own seed script or queries, run by hand; whether that is a full reset or a few rows depends on the app, so nothing runs it automatically and tests don't seed data themselves. Replay never touches the database. A record run saves the recording even when the test fails, so re-record after a failure.

### Config file

Anything passed on the CLI can instead live in a config file, auto-discovered as `test-proxy-recorder.config.{ts,js,mjs,cjs}` in the proxy process's working directory (or `--config <path>`). Prefer it over a long `proxy` script once you need body-redaction regexes — they go in as real `RegExp` literals instead of shell-escaped strings.

```typescript
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  redaction: {
    headers: ['x-api-key'],         // merged with the Authorization/Cookie defaults
    bodyPatterns: [/sk_live_\w+/g],
    allowCookies: ['theme'],
  },
});
```

```json
// package.json — with a config file, the proxy script needs no flags
{ "scripts": { "proxy": "test-proxy-recorder" } }
```

Precedence is **CLI flag → config file → built-in default**: a flag always overrides the file, and `target` may come from either (the CLI argument wins). List flags (`--redact-headers`, `--redact-body`, `--allow-headers`, `--allow-cookies`) **replace** the corresponding config list rather than merging, so pass them only when you intend to override the file. Redaction is on by default; `--no-redact` turns it off, overriding a `redaction` object in the config (and `redaction: false` in the config disables it without the flag).

### Secret redaction

Recordings are committed to git, so secrets are stripped **automatically** before anything is written to disk. By default the proxy replaces the values of the `Authorization`, `Cookie`, and `Set-Cookie` headers with `[REDACTED]` in both `.mock.json` and WebSocket recordings. This is safe — replay matching ignores these headers, so redaction never breaks playback. No setup required.

Tweak it via CLI flags on the `test-proxy-recorder` command:

```bash
# Redact an extra API-key header and any "sk_live_..." token in bodies,
# but keep the harmless theme cookie unredacted
test-proxy-recorder http://localhost:3002 --port 8100 --dir ./e2e/recordings \
  --redact-headers x-api-key,x-auth \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale

# Disable redaction (commit raw secrets — not recommended)
test-proxy-recorder http://localhost:3002 --no-redact
```

- `--redact-headers <names>` — comma-separated extra header names, merged with the defaults.
- `--redact-body <patterns>` — comma-separated regex patterns replaced in request/response bodies.
- `--allow-headers <names>` — comma-separated header names to exempt from redaction (e.g. `set-cookie`).
- `--allow-cookies <names>` — comma-separated cookie names kept unredacted inside `Cookie`/`Set-Cookie`; every other cookie in those headers is still redacted. Use when only some cookies are sensitive (session vs. theme/A-B-test).
- `--no-redact` — turn redaction off.

`.har` files are written by Playwright's `routeFromHAR`, not the proxy, so they are redacted in a separate pass: `playwrightProxy.teardown()` rewrites every `.har` in the recordings dir using the **same** redaction config as the proxy. This requires a `globalTeardown` that calls `teardown()` (see below) and the proxy still running (it fetches the config from `/__control`). For defense in depth, still record with short-lived test credentials and use the Auth setup pattern below (login runs in `transparent` mode against the real provider, with `storageState` saved to a gitignored file).

### Auth setup

Auth always runs against the real auth provider — never recorded or replayed. Use `setProxyMode('transparent')` so auth requests bypass the proxy entirely. Skip the auth step in replay mode (the recorded session is already embedded in the HAR / storage state file from the previous record run).

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

Include the auth provider domain in `CLIENT_SIDE_URL` when the browser makes direct calls to it (e.g. Cognito token refresh, OAuth redirects):

```typescript
// These browser-to-Cognito calls are recorded in the HAR, not via the proxy.
const CLIENT_SIDE_URL = /cognito-.*\.amazonaws\.com/;
```

### Replaying without the backend (external-auth apps)

When login goes to an external provider (Cognito, Auth0, Clerk, …), the protected API responses come from recordings, so **replay needs no backend** — CI runs only the app + proxy. Recording stays a **manual, local** step (you, on a dev machine, with the real backend up); **CI only replays** from the committed recordings:

```jsonc
{
  "scripts": {
    "start:all":        "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm start\"",
    "start:no-backend": "concurrently \"pnpm proxy\" \"pnpm start\"",
    // LOCAL: run on a dev machine to (re)record, then COMMIT e2e/recordings/
    "record":   "pnpm build && concurrently --kill-others --success first \"pnpm start:all\" \"wait-on $APP $PROXY/__control && RECORD_MODE=1 playwright test --workers 1\"",
    // CI: replay from committed recordings — app + proxy only, no backend
    "test:e2e": "pnpm build && concurrently --kill-others --success first \"pnpm start:no-backend\" \"wait-on $APP $PROXY/__control && playwright test --retries 1\""
  }
}
```

So the lifecycle is: `pnpm record` locally → commit `e2e/recordings/` → CI runs `pnpm test:e2e` with no backend. (Re-record only when the API changes.)

If your auth `setup` re-authenticates during replay (instead of reusing a committed `storageState`), snapshot `storageState` as soon as the session token exists — don't wait for a protected data fetch, which runs in transparent mode and would hang with no backend:

```typescript
await page.waitForURL('/dashboard');
// the token is written to storage before the redirect — snapshot now, do NOT
// wait for the protected data to load (that request would hang without a backend)
await page.waitForFunction(() => !!localStorage.getItem('auth-token'));
await page.context().storageState({ path: AUTH_FILE });
```

See `apps/example-auth-cognito` (real Cognito) and `apps/example-auth-mock` (self-contained, no cloud account). Those apps additionally re-record on every CI run to test the recorder itself — *your* app should record locally and only replay in CI.

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
    failOnMissingRecording, // replay: fail on an unrecorded request (default: true)
  }
);
```

`url` is optional. Omit it for proxy-only (SSR) recording with no browser-side HAR interception.

### Recording names and replay matching

Each test's recordings are named from its file, `describe` titles and title. Replay matches by method, path and query, ignores bodies, and fails the test at once on a request with no recording (opt out with `failOnMissingRecording: false`). Details: [references/replay-matching.md](references/replay-matching.md).

### Control endpoint

```bash
# Check current proxy state
curl http://localhost:8100/__control

# Programmatically switch mode
curl -X POST http://localhost:8100/__control \
  -H 'Content-Type: application/json' \
  -d '{"mode": "record", "id": "my-test"}'
```

Override the default port (8100) with the `TEST_PROXY_RECORDER_PORT` env var; the proxy, `reset` and the Playwright helpers all read it.

### Resetting a stuck proxy

The proxy auto-reverts to `transparent` after each session times out, and `globalTeardown` resets it at the end of a clean run. But an **interrupted** run (Ctrl+C), a UI/debug session, or a setup without `globalTeardown` can leave the shared proxy stuck in `record`/`replay`, so the app keeps serving recorded responses. Reset it on demand:

```bash
test-proxy-recorder reset          # or: pnpm proxy:reset
```

This POSTs `{ "mode": "transparent" }` to `/__control` — the supported, parallel-safe replacement for resetting by hand with `curl`. It is safe to run anytime: an unreachable proxy is a no-op. The port is resolved with **`--port` flag → `TEST_PROXY_RECORDER_PORT` env → config file → 8100**, so it targets the same port the proxy was started on. `proxy:reset` is scaffolded by `test-proxy-recorder init`.

Do **not** wire this into a per-test `afterEach` under `fullyParallel` — like `teardown()`, it flips the global mode and would disrupt other workers mid-session. It is a manual recovery tool, not a per-test hook.

## Common Mistakes

Common failure modes — each with the wrong vs. correct pattern — are in [references/common-mistakes.md](references/common-mistakes.md): app env var not pointed at the proxy, wrong `CLIENT_SIDE_URL` (matching the proxy instead of external domains), `teardown()` per-test breaking parallel replay, `webServer.url` not on `/__control`, gitignored recordings, recording against the Next.js dev server or with multiple workers, and a separate backend or database for tests.

## Getting help

If the user encounters unexpected behavior, a bug, or a use case not covered by these patterns, direct them to open a GitHub issue at https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new. A minimal reproduction helps the maintainer resolve it quickly.

See also: test-proxy-recorder/nextjs-ssr — for tagging Next.js SSR fetches (registerProxyFetch / registerProxyAxios; the middleware is optional)
