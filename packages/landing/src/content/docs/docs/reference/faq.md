---
title: FAQ
description: Common questions about test-proxy-recorder — parallel replay, committing recordings to git, the proxy target for HAR recording, the Next.js dev server, and updating recordings.
---

## My parallel replay tests sometimes hit the real backend — why? {#parallel-replay}

You're likely calling `playwrightProxy.teardown()` in a per-test hook. It sets the **global** proxy mode to `transparent`, and with `fullyParallel: true` each Playwright worker runs its own `test.afterAll`. If a fast test finishes and calls `teardown()` while a slower test is still running, the proxy flips to transparent mid-test and the remaining requests are forwarded to the real backend instead of being replayed.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Fix:** omit `test.afterAll`. Session cleanup is automatic via `context.on('close')` → `cleanupSession()`. Use a [global teardown](https://playwright.dev/docs/test-global-setup-teardown) only if you need to reset the proxy after the entire run.

The session timeout is the other way a replay run reaches the real backend. Every `playwrightProxy.before()` call restarts it, and proxied requests don't. If it runs out (120000 ms by default) before the next `before()` call, the proxy switches to `transparent`. A test that is still running then sends its remaining requests to the real backend. If one test can run that long, raise the timeout with `--timeout` on the [CLI](/docs/guides/cli/) or `timeout` in the [config](/docs/guides/config/).

## Can I record with parallel workers? {#parallel-recording}

No. The proxy holds one recording session at a time. When a second test starts recording, the proxy saves the first test's file and switches to the second test. The first test's remaining requests through the proxy then go into the second test's `.mock.json`. Record with one worker, as the `test:e2e:record` script that `init` adds already does:

```bash
npx playwright test --workers 1
```

Replay can run with parallel workers. Each test replays its own session, and the `x-test-rcrd-id` header tells them apart: `playwrightProxy.before()` sets it on the page's requests, and `registerProxyFetch()` copies it onto server-side ones. The [example apps](/docs/reference/examples/) record with `--workers 1` for this reason.

## Should I commit recordings to git?

Yes. Recordings must be in git so CI can replay them with no network — do **not** add `e2e/recordings` to `.gitignore`. To keep large recording files from crowding PR reviews, mark them generated in `.gitattributes`: GitHub collapses their diffs by default and still shows them on one click, so a field the API renamed stays visible in review. Marking them `binary` would hide that change entirely.

```text
/e2e/recordings/** linguist-generated=true
```

## Does the proxy `<target-url>` matter for browser-only (HAR) recording?

No. For browser-only recording the target is irrelevant — the proxy process just needs to run so its `/__control` endpoint is available for session management. The target only matters when server-side (SSR) requests are also routed through the proxy.

## What happens to browser requests outside the `url` pattern? {#outside-url}

Playwright doesn't intercept them, so they go to the real network in record and replay alike. Nothing is saved for them. Requests to the proxy (`localhost:8100`) are the exception. `playwrightProxy.before()` always sends those on to the proxy, which records and replays them itself.

To keep a test off the network, widen `url` so the HAR covers the domain, or block the domain with `page.route()` and `route.abort()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  // The HAR also records and replays the CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Analytics calls fail instead of reaching the network.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

[How replay matches requests](/docs/getting-started/how-it-works/#replay-matching) has the details.

## Can I record against the Next.js dev server?

Prefer `next build` + `next start` over `next dev` for recording and replaying. The dev server is slow and can cause timeouts or flaky recordings.

## How do I update a recording?

Re-run in record mode (set `MODE = 'record'` in your fixture, or `RECORD_MODE=1`) against the real API, then switch back to replay and commit the updated files in `e2e/recordings/`.

## Can I force an error, an empty list or a slow response in a replayed test? {#override-responses}

Yes, for browser requests. Playwright runs route handlers [in the reverse order of registration](https://playwright.dev/docs/api/class-route#route-fallback), so a `page.route()` added after `playwrightProxy.before()` sees each request first. It can answer the request itself, or call `route.fallback()` to pass it on to the recordings.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Added after before(), so Playwright runs this handler first.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // every other request is replayed as recorded
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

For an empty list, fulfil with `json: []` instead. For a slow response, wait before calling `route.fallback()`, for example with `await new Promise((resolve) => setTimeout(resolve, 3000))`. The recorded response then arrives three seconds late.

Server-side requests never pass through the browser, so `page.route()` can't change them. For those, edit the recording in the `.mock.json` by hand, or record against an API in the state you need. In the file, each recording's `response` holds `statusCode`, `headers` and `body`. If you change the body's length, delete the `content-length` header too.

## Can I use it when the suite tests a deployed environment? {#deployed-environment}

Yes, for browser requests. Playwright intercepts them in the browser, so the HAR records and replays them with no change to the deployed app. Point `url` at the API domain the browser calls. The proxy still has to run next to the tests, because `playwrightProxy.before()` sets each test's mode through its `/__control` endpoint.

Server-side requests are made by the app's server, so a proxy in CI never sees the ones a deployed server makes. To record or replay them, run the app's server in CI next to the proxy. Build and start it for the test run with its API base URL pointed at the proxy and `TEST_PROXY_RECORDER_ENABLED=true` set. The [Next.js](/docs/integrations/nextjs/) and [TanStack Start](/docs/integrations/tanstack-start/) pages show this setup.
