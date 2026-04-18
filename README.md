# test-proxy-recorder

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)

Fast, deterministic Playwright tests without maintaining manual mocks.

An HTTP proxy that records real API responses during test runs and replays them on CI -- no backend required. Instead of hand-writing mock fixtures, just run your tests once against the real API and commit the recordings. Supports Next.js and SSR.

```
                        Record mode                          Replay mode

  Browser/App ──> Proxy ──> Real API        Browser/App ──> Proxy ──> Disk
                    │                                         │
                    └──> saves to disk                        └──> serves saved responses
                         (.mock.json)                              (.mock.json)
```

## Why

- **No backend on CI** -- record once against the real API, replay on every CI run
- **No manual mocks** -- capture real interactions instead of hand-writing fixtures
- **SSR support** -- records server-side requests from Next.js and similar frameworks
- **Deterministic** -- same responses every time, no flaky network
- **WebSocket support** -- records and replays WebSocket connections

## Quick Start

### 1. Install

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Add scripts to `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings"
  }
}
```

> **Tip:** Use `concurrently` to run proxy + app together.
> `INTERNAL_API_URL` is the env var your app uses for the API base URL -- point it at the proxy instead of the real backend. Use proxy address for dev/test and real backend for production environment.
> Replace it with whatever env var your app uses (e.g. `API_URL`, `NEXT_PUBLIC_API_URL`).
>
> ```json
> {
>   "scripts": {
>     "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
>     "dev:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\"",
>     "serve:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run serve\""
>   }
> }
> ```
>
> **Next.js note:** Prefer `build` + `serve` over `dev` for recording/replaying tests. The Next.js dev server is slow and can cause timeouts or flaky recordings.

### 3. Write a test

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('homepage loads', async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'record'); // first run: record
  // await playwrightProxy.before(page, testInfo, 'replay'); // later: replay

  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Run

Start the proxy + app first (e.g. `npm run serve:proxy`), then run tests in a separate terminal:

```bash
# Terminal 1 -- start proxy and app
npm run serve:proxy

# Terminal 2 -- run tests
npx playwright test
```

### 5. Commit recordings to git

```bash
# .gitattributes -- collapse long mock files in PR diffs
/e2e/recordings/** binary
```

> Do **not** add `e2e/recordings` to `.gitignore`. Recordings must be in git for CI replay.

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

## Playwright Integration

### Basic pattern

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('my test', async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay');
  // ... test code
});
```

`playwrightProxy.before()` sets the proxy mode, attaches a session header (`x-test-rcrd-id`), and registers cleanup on page close. Recording filenames are derived from test names (`"create a user"` -> `create-a-user.mock.json`).

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

### Client-side recording (3rd party APIs)

For browser-side requests that don't go through the proxy (e.g. AWS Cognito, analytics), use HAR recording:

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  url: /cognito-.*amazonaws\.com|\.stream-io-api\.com/,
});
```

Recordings are stored alongside server-side files:

```
e2e/recordings/
  my-test.mock.json   # server-side (proxy)
  my-test.har         # client-side (HAR)
```

## Next.js Integration

The proxy identifies sessions via a custom header. For SSR requests to carry this header, use one of:

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

## API Reference

### `playwrightProxy`

```typescript
const playwrightProxy: {
  before(
    page: Page,
    testInfo: TestInfo,
    mode: 'record' | 'replay' | 'transparent',
    options?: number | { url?: string | RegExp; timeout?: number }
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

## Typical Workflow

```
1. Record       start proxy + app + backend, run tests with 'record' mode
2. Commit       git add e2e/recordings/
3. Replay       start proxy + app (no backend), run tests with 'replay' mode
4. Update       re-record when API changes, commit new recordings
```

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

## Parallel Replay: Do Not Call `teardown()` Per-Test

`playwrightProxy.teardown()` sets the **global** proxy mode to `transparent`. With `fullyParallel: true`, each Playwright worker runs its own `test.afterAll`. If a fast test completes and calls `teardown()` while a slower test (e.g., one with more interaction steps) is still running, the proxy switches to transparent mid-test. The remaining requests are forwarded to the real backend instead of being replayed, causing failures.

**Wrong:**

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Correct:** omit `test.afterAll`. Session cleanup is automatic via `context.on('close')` → `cleanupSession()`. Use a [global teardown](https://playwright.dev/docs/test-global-setup-teardown) if you need to reset the proxy after a full test run.

## Requirements

- Node.js >= 22.0.0
- @playwright/test >= 1.0.0 (peer dependency)

## Contributing

Contributions welcome! Please submit a Pull Request.

## License

MIT
