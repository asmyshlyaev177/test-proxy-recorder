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

## Should I commit recordings to git?

Yes. Recordings must be in git so CI can replay them with no network — do **not** add `e2e/recordings` to `.gitignore`. To keep large recording files from bloating PR diffs, mark them binary in `.gitattributes`:

```text
/e2e/recordings/** binary
```

## Does the proxy `<target-url>` matter for browser-only (HAR) recording?

No. For browser-only recording the target is irrelevant — the proxy process just needs to run so its `/__control` endpoint is available for session management. The target only matters when server-side (SSR) requests are also routed through the proxy.

## Can I record against the Next.js dev server?

Prefer `next build` + `next start` over `next dev` for recording and replaying. The dev server is slow and can cause timeouts or flaky recordings.

## How do I update a recording?

Re-run in record mode (set `MODE = 'record'` in your fixture, or `RECORD_MODE=1`) against the real API, then switch back to replay and commit the updated files in `e2e/recordings/`.
