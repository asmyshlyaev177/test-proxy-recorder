# test-proxy-recorder

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)

Fast, deterministic Playwright tests without maintaining manual mocks.

Records real API responses during test runs and replays them on CI — no backend required. Supports two recording mechanisms depending on where your requests originate:

```text
                        Record mode                          Replay mode

  Browser/App ──> Proxy ──> Real API        Browser/App ──> Proxy ──> Disk
                    │                                         │
                    └──> saves to disk                        └──> serves saved responses
                         (.mock.json)                              (.mock.json)
```

| Mechanism | What it records | Use case |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Server-side requests (SSR fetches from Next.js etc.) | Full-stack apps where the server calls the API |
| **HAR** (`.har`) | Browser-side requests (browser `fetch`, extensions, SPAs) | SPAs, Chrome extensions, 3rd-party APIs |

Both can be used together or independently.

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

## Why

- **No backend on CI** — record once against the real API, replay on every CI run
- **No manual mocks** — capture real interactions instead of hand-writing fixtures
- **SSR support** — records server-side requests from Next.js and similar frameworks
- **Browser-side support** — records browser `fetch` calls, Chrome extension API calls, analytics, etc.
- **Deterministic** — same responses every time, no flaky network
- **WebSocket support** — records and replays WebSocket connections

---

## Browser-only / SPA / Extension Quick Start

If your app or extension makes API calls entirely from the browser (no SSR), you only need the HAR mechanism. No proxy backend is required for the actual recording — the proxy process just provides session management.

### 1. Install

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Add the proxy to `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

> The proxy target (`https://api.example.com`) does not matter for browser-only recording — it is only used if server-side (SSR) requests also need to be proxied. The proxy process must run so its `/__control` endpoint is available for session management.

### 3. Write a fixture

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Match the external API domain your browser makes requests to.
// In record mode these requests go to the real API and are saved.
// In replay mode they are served from disk — no network needed.
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
```

### 4. Write a test

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Record — run once against the real API

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. Switch to replay and commit

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

CI now runs without any network access.

> Do **not** add `e2e/recordings` to `.gitignore`. Recordings must be in git for CI replay.
>
> Add this to `.gitattributes` to collapse large recording files in PR diffs:
>
> ```text
> /e2e/recordings/** binary
> ```

---

## Full-stack (SSR + browser) Quick Start

For apps like Next.js where both the server AND the browser make API calls, use both mechanisms together.

### 1. Add scripts to `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run serve\""
  }
}
```

> `INTERNAL_API_URL` is the env var your app uses for the API base URL — point it at the proxy instead of the real backend. Replace it with whatever env var your app uses (e.g. `API_URL`, `NEXT_PUBLIC_API_URL`).
>
> **Next.js note:** Prefer `build` + `serve` over `dev` for recording/replaying tests. The Next.js dev server is slow and can cause timeouts or flaky recordings.

### 2. Write a test

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR requests (server → proxy) are recorded to .mock.json.
// Browser requests to the proxy URL are also covered.
const CLIENT_SIDE_URL = /localhost:8100/;

// Change to 'record' to update recordings.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 3. Record

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. Switch to replay and commit

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

---

## CLI

```bash
test-proxy-recorder <target-url> [options]
```

| Option         | Default        | Description                   |
| -------------- | -------------- | ----------------------------- |
| `<target-url>` | *(required)*   | Backend URL to proxy          |
| `--port, -p`   | `8080`         | Proxy listen port             |
| `--dir, -d`    | `./recordings` | Directory for recording files |

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

---

## Playwright Integration

### `playwrightProxy.before(page, testInfo, mode, options?)`

Call this at the start of each test (or in a `beforeEach` / page fixture). It sets the proxy mode for the session and, if `url` is provided, sets up HAR recording for browser-side requests.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**`url` pattern:** matches the real external domain that the browser calls. In record mode requests go to the real API and are saved to a `.har` file. In replay mode they are served from that file — no network needed. This pattern does **not** point to the proxy (`localhost:8100`).

**Exception — full-stack apps:** when the browser also calls `localhost:8100` (because the frontend is configured with the proxy URL as its API base), use `/localhost:8100/` as the pattern.

Recording filenames are derived from test names (`"create a user"` → `create-a-user.mock.json` / `.har`).

### Global teardown (recommended)

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

### Recording files

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```

---

## Next.js Integration

SSR frameworks like Next.js make server-side `fetch` calls that go through the proxy without a browser context. The proxy identifies which session those requests belong to via the `x-test-rcrd-id` header — the same header `playwrightProxy.before()` sets on the browser `page`. This header is **only required for SSR** — for browser-only tests the proxy falls back to the globally set session automatically.

For SSR requests to carry this header, use one of:

### Middleware (recommended)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}
```

### Manual header forwarding

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

---

## Control Endpoint

The proxy exposes `/__control` for programmatic mode switching.

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode: 'transparent' | 'record' | 'replay';
  id?: string;       // required for record/replay
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
}
```

---

## API Reference

### `playwrightProxy`

```typescript
const playwrightProxy: {
  before(
    page: Page,
    testInfo: TestInfo,
    mode: 'record' | 'replay' | 'transparent',
    options?: { url?: string | RegExp; timeout?: number }
  ): Promise<void>;

  teardown(): Promise<void>;
};
```

### `setProxyMode`

```typescript
function setProxyMode(
  mode: 'record' | 'replay' | 'transparent',
  id?: string,
  timeout?: number
): Promise<void>;
```

### Next.js helpers (`test-proxy-recorder/nextjs`)

```typescript
function setNextProxyHeaders(request: NextRequest, response: NextResponse): void;
function getRecordingId(headers: NextRequest | Headers): string | null;
function createHeadersWithRecordingId(
  headers: NextRequest | Headers,
  additional?: Record<string, string>
): Record<string, string>;
```

---

## Next.js 16

Next.js 16 uses `proxy.ts` as the middleware entry point (replaces `middleware.ts`). Place it at the project root alongside `next.config.ts`:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**package.json scripts** — start services from scripts, not from `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

## Example App

[`apps/example-nextjs16`](apps/example-nextjs16) is a full working example: a Next.js 16 todo app wired up with a mock backend, proxy, and Playwright e2e tests in record/replay mode.

```text
apps/example-nextjs16/
  app/                  Next.js pages and components
  mock-backend/         Standalone Node.js HTTP server (port 3002)
  e2e/                  Playwright tests + recordings
  proxy.ts              Next.js 16 middleware — forwards session headers to SSR fetches
```

**Three-service architecture:**

```text
Browser  ──> Proxy (8100) ──> Mock Backend (3002)
Next.js SSR ──> Proxy (8100) ──> Mock Backend (3002)
```

Start everything and run the record/replay cycle:

```bash
# Start all services (mock backend + proxy + Next.js)
pnpm --filter example-nextjs16 start:all

# Record tests (run against live services, save to e2e/recordings/)
pnpm --filter example-nextjs16 test:e2e:record

# Replay tests (no backend needed — served from recordings)
pnpm --filter example-nextjs16 test:e2e
```

---

## Parallel Replay: Do Not Call `teardown()` Per-Test

`playwrightProxy.teardown()` sets the **global** proxy mode to `transparent`. With `fullyParallel: true`, each Playwright worker runs its own `test.afterAll`. If a fast test completes and calls `teardown()` while a slower test is still running, the proxy switches to transparent mid-test and remaining requests are forwarded to the real backend instead of being replayed.

**Wrong:**

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Correct:** omit `test.afterAll`. Session cleanup is automatic via `context.on('close')` → `cleanupSession()`. Use a [global teardown](https://playwright.dev/docs/test-global-setup-teardown) if you need to reset the proxy after a full test run.

---

## AI Agent Skills

If you use an AI coding agent (Claude Code, Cursor, Copilot, etc.), install the skills for this library so the agent generates correct setup code:

```bash
npx @tanstack/intent@latest install
```

This adds `test-proxy-recorder` skills to your project. The agent will then know the correct proxy/fixture setup, record vs. replay workflow, and Next.js SSR header patterns without needing guidance.

---

## Requirements

- Node.js >= 22.0.0
- @playwright/test >= 1.0.0 (peer dependency)

## Contributing

Contributions welcome! Please submit a Pull Request.

## License

MIT
