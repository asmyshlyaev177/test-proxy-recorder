# test-proxy-recorder — Common Mistakes

Failure modes when setting up record/replay, each with the wrong vs. correct
pattern. Loaded on demand from the `proxy-setup` skill.

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
out of order, producing incomplete recordings that fail in replay. It can also
reset a `registerProxyFetch` global-`fetch` patch between requests
([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), so SSR
fetches lose the session id — another reason to record against build+start.

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
