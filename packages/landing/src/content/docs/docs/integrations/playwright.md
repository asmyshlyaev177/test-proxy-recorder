---
title: Playwright
description: Use test-proxy-recorder from Playwright tests — the before() session hook, the recommended global teardown, and where recording files land.
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

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

## Global teardown (recommended)

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

`teardown()` resets the proxy to `transparent` and runs the HAR [redaction](/docs/guides/secret-redaction/) pass. Don't call it in a per-test `afterAll` hook under `fullyParallel` — see the [FAQ](/docs/reference/faq/#parallel-replay) for why that breaks parallel replay.

## Recording files

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
