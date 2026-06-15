# test-proxy-recorder

> **VCR for Playwright** — record real API responses once, replay them deterministically on CI. Covers Next.js SSR, browser, and WebSocket traffic. No backend, no hand-written mocks.

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)

Fast, deterministic Playwright tests without maintaining manual mocks.

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Recording real API responses, then replaying them on CI with the backend turned off" width="800">
</p>

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

## Contents

- [Why](#why)
- [Full-stack (SSR + browser) Quick Start](#full-stack-ssr--browser-quick-start)
- [Browser-only / SPA / Extension Quick Start](#browser-only--spa--extension-quick-start)
- [CLI](#cli)
  - [Reset a stuck proxy](#reset-a-stuck-proxy)
  - [Config file](#config-file)
- [Secret redaction](#secret-redaction)
- [Example Apps](#example-apps)
- [Playwright Integration](#playwright-integration)
- [Next.js Integration](#nextjs-integration)
- [Control Endpoint](#control-endpoint)
- [API Reference](#api-reference)
- [Next.js 16](#nextjs-16)
- [FAQ](#faq)
- [AI Agent Skills](#ai-agent-skills)
- [Roadmap](#roadmap)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## Why

- **No backend on CI** — record once against the real API, replay on every CI run
- **No manual mocks** — capture real interactions instead of hand-writing fixtures
- **SSR support** — records server-side requests from Next.js and similar frameworks
- **Browser-side support** — records browser `fetch` calls, Chrome extension API calls, analytics, etc.
- **Deterministic** — same responses every time, no flaky network
- **WebSocket support** — records and replays WebSocket connections

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

## CLI

```bash
test-proxy-recorder <target-url> [options]
```

| Option           | Default        | Description                         |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(required)*   | Backend URL to proxy                |
| `--port, -p`     | `8000`         | Proxy listen port                   |
| `--dir, -d`      | `./recordings` | Directory for recording files       |
| `--timeout, -t`  | `120000`       | Session auto-reset timeout (ms)     |
| `--config, -c`   | *(auto)*       | Path to a config file (see below)   |
| `--ws-timing`    | `burst`        | WebSocket replay pacing — `burst` or `original` (see below) |

Secrets are redacted from recordings by default — see [Secret redaction](#secret-redaction) for the `--no-redact`, `--redact-headers`, and `--redact-body` flags.

By default, recorded WebSocket server messages are replayed as a **burst** on connect — fastest and fully deterministic, ideal for CI. Pass `--ws-timing original` (or `websocket: { timing: 'original' }` in the config) to instead re-pace them using the recorded timestamps, so messages arrive with their real inter-message gaps; a test then takes roughly the recording's wall-clock span. You can also set this **per test** via `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, which overrides the proxy-level default for that session only.

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

### Reset a stuck proxy

The proxy auto-reverts to `transparent` after each session times out, and the
`globalTeardown` resets it at the end of a clean run. But an **interrupted** run
(`Ctrl+C`), a UI/debug session, or a config without `globalTeardown` can leave
the shared proxy stuck in `record`/`replay` — so your app keeps serving recorded
responses instead of hitting the real backend. Reset it on demand:

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

This POSTs `{ "mode": "transparent" }` to `/__control` — the supported,
parallel-safe replacement for resetting by hand with `curl`. It's safe to run
anytime: an unreachable proxy is treated as a no-op. The port is resolved as
**`--port` flag → `TEST_PROXY_RECORDER_PORT` env → config file → `8000`**, so it
targets the port the proxy was started on (pass `--port` / `--config` to
override). `init` scaffolds this as the `proxy:reset` script.

### Scaffold the setup (`init`)

One command wires test-proxy-recorder into a project:

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

It generates / edits, **non-destructively**:

- `test-proxy-recorder.config.ts` — the proxy config (auto-discovered, so
  `npx test-proxy-recorder` then needs no flags).
- `playwright.config.ts` — adds a `webServer` pointing at the proxy's
  `/__control` endpoint plus a `globalTeardown`. If you already have a Playwright
  config it's **edited in place**; if you don't have Playwright at all, `init`
  runs the Playwright CLI to set it up first (pass `--no-install` to skip).
- `e2e/fixtures.ts` and `e2e/global-teardown.ts` — the per-test proxy fixture and
  teardown.
- `package.json` — adds `proxy`, `proxy:reset`, `test:e2e`, and
  `test:e2e:record` scripts. If
  you have a `dev` script it's wrapped: the original moves to `dev:app` and `dev`
  becomes a `concurrently` command that runs the proxy alongside your app (so
  `npm run dev` records while you develop). `concurrently` is added to
  `devDependencies`.

All arguments are optional and fall back to sensible defaults
(`http://localhost:3000`, port `8100`, `./e2e/recordings`). Existing files and
scripts are never overwritten unless you pass `--force`; a Playwright config that
already defines a `webServer` is left untouched (with a note on what to add).

The **one step it can't do for you** is routing your app's backend calls through
the proxy — which env var holds your API base URL, and how you scope it to dev,
is app-specific. `init` prints concrete instructions for this when it finishes:
point that env var at `http://localhost:8100` **in dev/test only, never in
production** (e.g. prefix the `dev:app` script, using `cross-env` on Windows).
The proxy then forwards to your real backend while recording and serves
recordings on replay.

### Config file

For anything beyond a couple of flags — especially body-redaction regexes — put the
options in a config file instead. The proxy auto-discovers
`test-proxy-recorder.config.{ts,js,mjs,cjs}` in the current directory, or pass
`--config <path>` to point at one explicitly. `.ts` files work out of the box.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  redaction: {
    headers: ['x-api-key'],         // extra headers, merged with the defaults
    bodyPatterns: [/sk_live_\w+/g], // real RegExp literals — no CLI escaping
    allowCookies: ['theme'],        // keep these cookies unredacted
  },
  websocket: {
    timing: 'burst',                // 'burst' (default) or 'original' (re-paced)
  },
});
```

```bash
test-proxy-recorder                 # all options from the config file
test-proxy-recorder --port 9000     # config file, but CLI port wins
```

**Precedence:** every option resolves as **CLI flag → config file → built-in default**.
A flag you pass on the command line always overrides the config file; anything you
omit falls back to the config, then the default. (List flags like `--redact-headers`
*replace* the config's list rather than merging — pass it only when you want to
override.) `target` may be given as the CLI argument or as `target` in the config;
the argument wins when both are present.

---

## Secret redaction

<details>
<summary>Secrets are stripped automatically by default — show details</summary>

Recordings are meant to be committed to git, so secrets are stripped **automatically** before anything is written to disk. By default the proxy replaces the values of these request/response headers with `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

This is safe: replay matching ignores these headers, so redaction never breaks playback. It applies to both `.mock.json` recordings and WebSocket recordings.

When only *some* cookies are sensitive, allow-list the harmless ones by name (e.g. a `theme` or A/B-test cookie). Allow-listed cookies keep their values inside `Cookie`/`Set-Cookie`; every other cookie is still redacted.

> **Note:** `.har` files (browser-side requests recorded via Playwright's `routeFromHAR`) are written by Playwright, not the proxy, so this redaction does not cover them. Keep tokens out of HAR by recording with short-lived test credentials and reviewing HARs before committing — see the recommended setup-auth pattern below.

### Recommended auth pattern

To keep the login flow and credentials out of recordings entirely, run authentication in a Playwright **setup project** with the proxy in `transparent` mode, persist `storageState` to a **gitignored** `auth-state.json`, and reuse it in your tests. Recorded requests then carry only the (redacted) session headers, never the login.

### Tweaking what gets redacted

The defaults always apply while redaction is enabled; you can add to them or turn it off.

**CLI flags:**

- `--redact-headers <names>` — comma-separated extra header names to redact (merged with the defaults).
- `--redact-body <patterns>` — comma-separated regex patterns to redact from request/response bodies.
- `--allow-headers <names>` — comma-separated header names to exempt from redaction (e.g. `set-cookie`).
- `--allow-cookies <names>` — comma-separated cookie names to keep unredacted inside `Cookie`/`Set-Cookie`.
- `--no-redact` — disable redaction and commit raw secrets (not recommended).

```bash
# Redact an API-key header and "sk_live_..." tokens, but keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

**Programmatic** (when constructing `ProxyServer` directly):

```typescript
import { ProxyServer } from 'test-proxy-recorder';

const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  enabled: true,                       // default; set false to disable
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

`redactSession(session, config)` is also exported if you want to redact existing recordings yourself.

</details>

---

## Example Apps

Full working examples live in [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — one per recording mechanism. Each has its own README with the full setup and record/replay workflow.

### Next.js 16 — server-side (proxy / `.mock.json`)

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — a Next.js 16 todo app with a mock backend, proxy, and Playwright e2e tests. Records both SSR fetches (`.mock.json`) and browser fetches (`.har`), and includes a WebSocket chat against the local backend. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

### Chrome extension — browser-side (HAR / `.har`)

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — a real Chrome extension that calls X/Twitter's API from a content script; browser requests are recorded to `.har` and replayed offline, with no live API or account needed on CI. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

### Crypto ticker — third-party WebSocket (`.mock.json`)

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — a live BTC-USD price ticker backed by Binance's public WebSocket feed. Records the real feed once through the proxy, then replays deterministic prices on CI with no network or exchange account. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

---

## Playwright Integration

<details>
<summary>Show details</summary>

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

</details>

---

## Next.js Integration

<details>
<summary>Show details</summary>

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

</details>

---

## Control Endpoint

<details>
<summary>Show details</summary>

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

</details>

---

## API Reference

<details>
<summary>Show details</summary>

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

### `defineConfig`

Type-checked identity helper for a `test-proxy-recorder.config.{ts,js,mjs}` file
(see [Config file](#config-file)).

```typescript
function defineConfig(config: Config): Config;

interface Config {
  target?: string;
  port?: number;
  recordingsDir?: string;
  timeout?: number;
  redaction?: RedactionConfig;
}
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

</details>

---

## Next.js 16

<details>
<summary>Show details</summary>

Next.js 16 uses `proxy.ts` as the middleware entry point (replaces `middleware.ts`). Place it at the project root alongside `next.config.ts`:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
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

</details>

---

## FAQ

<details>
<summary><strong>My parallel replay tests sometimes hit the real backend — why?</strong></summary>

You're likely calling `playwrightProxy.teardown()` in a per-test hook. It sets the **global** proxy mode to `transparent`, and with `fullyParallel: true` each Playwright worker runs its own `test.afterAll`. If a fast test finishes and calls `teardown()` while a slower test is still running, the proxy flips to transparent mid-test and the remaining requests are forwarded to the real backend instead of being replayed.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Fix:** omit `test.afterAll`. Session cleanup is automatic via `context.on('close')` → `cleanupSession()`. Use a [global teardown](https://playwright.dev/docs/test-global-setup-teardown) only if you need to reset the proxy after the entire run.

</details>

<details>
<summary><strong>Should I commit recordings to git?</strong></summary>

Yes. Recordings must be in git so CI can replay them with no network — do **not** add `e2e/recordings` to `.gitignore`. To keep large recording files from bloating PR diffs, mark them binary in `.gitattributes`:

```text
/e2e/recordings/** binary
```

</details>

<details>
<summary><strong>Does the proxy <code>&lt;target-url&gt;</code> matter for browser-only (HAR) recording?</strong></summary>

No. For browser-only recording the target is irrelevant — the proxy process just needs to run so its `/__control` endpoint is available for session management. The target only matters when server-side (SSR) requests are also routed through the proxy.

</details>

<details>
<summary><strong>Can I record against the Next.js dev server?</strong></summary>

Prefer `next build` + `next start` over `next dev` for recording and replaying. The dev server is slow and can cause timeouts or flaky recordings.

</details>

<details>
<summary><strong>How do I update a recording?</strong></summary>

Re-run in record mode (set `MODE = 'record'` in your fixture, or `RECORD_MODE=1`) against the real API, then switch back to replay and commit the updated files in `e2e/recordings/`.

</details>

---

## AI Agent Skills

If you use an AI coding agent (Claude Code, Cursor, Copilot, etc.), install the skills for this library so the agent generates correct setup code:

```bash
npx @tanstack/intent@latest install
```

This adds `test-proxy-recorder` skills to your project. The agent will then know the correct proxy/fixture setup, record vs. replay workflow, and Next.js SSR header patterns without needing guidance.

---

## Roadmap

First-class integrations on the way:

- **TanStack Start**
- **Remix**
- **Vite + SSR**

Need one sooner, or a different framework? [Open an issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).

---

## Requirements

- Node.js >= 20.0.0
- @playwright/test >= 1.0.0 (peer dependency)

---

## Contributing

Contributions welcome! Please submit a Pull Request.

---

## License

MIT
