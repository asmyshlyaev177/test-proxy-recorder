# Recording & replaying cached / ISR routes

How to record and replay a Next.js route that caches its SSR data (ISR), and the
non-obvious constraints that make some approaches flaky. Don't disable caching
for tests — record/replay works *with* it, but only one design is deterministic.

## The fundamental rule

**To replay an SSR fetch, the page must run that fetch at request time.**

Replay works by intercepting the server-side `fetch` to the proxy and returning a
recorded response. If the page serves prerendered HTML or a cached/stale render,
it never makes that fetch — there's nothing for the proxy to serve, and the
assertion sees stale content. So a route under test has to render (and fetch) on
the request, not serve a cached copy.

This collides with ISR, whose entire point is to *not* re-render on every
request. The resolution: during tests the page renders dynamically (it runs the
fetch); in production the page is still static ISR. See "Why the page goes
dynamic" below — it's intrinsic to recording SSR, not a hack.

## Recommended pattern: fetch-level `next.tags`

Cache the SSR fetch with `next.revalidate` + `next.tags`, and invalidate on
demand with `revalidateTag` before the assertion.

```tsx
// app/isr/page.tsx — NO `export const dynamic`, NO `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```ts
// app/api/revalidate/route.ts (authenticated — see below)
revalidateTag('isr-todos', 'max'); // Next 16 requires the 2nd profile arg
```

```ts
// e2e/isr.spec.ts
const revalidated = await page.request.post('/api/revalidate');
expect(revalidated.ok()).toBeTruthy(); // a silent 401 would leave a stale cache
await page.goto('/isr');               // one navigation — deterministic
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

Why this is deterministic:

- `revalidateTag` on a **fetch** cache entry is a *hard purge*: the next read is a
  cache miss that **blocks** and re-fetches. (Contrast `unstable_cache`, below.)
- The patched fetch reads `headers()` in the request scope, so the page renders
  dynamically during the test — it actually runs the fetch, through the proxy.
- The fetch data cache survives across the record → replay phases of one
  `next start` process, so you **must** purge it before the replay navigation or
  replay will serve the record-phase cache and never hit the proxy (false pass).
  Asserting `revalidated.ok()` guards against a silent auth failure doing the same.

## Why the page goes dynamic during tests (and that's fine)

`registerProxyFetch` tags each SSR fetch by reading the recording id from
`headers()`. Reading `headers()` opts the render into dynamic rendering. So:

- **Production** (no `TEST_PROXY_RECORDER_ENABLED`): the patch is a no-op, nothing
  reads `headers()`, and `/isr` is statically prerendered with 30s ISR — the
  normal caching behaviour, unchanged.
- **Tests**: the patch reads `headers()`, the page renders dynamically and runs
  its fetch through the proxy. This is the test exercising the real fetch, not a
  modification of production behaviour.

This render-mode difference is unavoidable: recording an SSR fetch requires
running it at request time, and routing it to the right replay session requires
reading a per-request header. Both force dynamic rendering. Tolerate it — it is
scoped to tests only.

## Approaches that look right but are flaky

All of these were tried and rejected; they fail because they serve
stale-while-revalidate (SWR) content on the request being asserted.

| Page | Caching primitive | Result |
|---|---|---|
| static ISR (`export const revalidate`) | `unstable_cache` | flaky — route-level SWR serves the stale prerender |
| `export const dynamic = 'force-dynamic'` | `unstable_cache` | flaky — `unstable_cache` itself is SWR on `revalidateTag` |
| static ISR | `unstable_cache` + a warm-up request before asserting | flaky — regeneration is background; one warm-up doesn't await it |
| **renders at request time** | **`fetch` + `next.tags`** | **deterministic** |

Key gotchas behind the table:

- **`unstable_cache` is stale-while-revalidate**, even on a `force-dynamic` page.
  `revalidateTag` marks its entry stale; the next read returns the *stale* value
  and regenerates in the **background**. The fresh value lands after the
  assertion. (fetch-level `next.tags` does a hard purge instead — that's the
  whole reason to prefer it.)
- **A static route serves its prerendered HTML.** With the backend down at build,
  the prerender is empty; on-demand revalidation then serves that empty page
  (SWR) while regenerating. The build log shows `revalidating cache ... fetch
  failed` and the route as `○ /isr`.
- **Polling doesn't reliably save it.** Re-navigating in a loop *can* eventually
  catch the regenerated page, but background regeneration may not finish within
  the test's window even though it completes before the next test run (the retry
  passes in ~500ms while the first attempt times out). A Playwright `expect`
  auto-retry on a locator does **not** re-navigate — it re-queries the already
  loaded stale DOM — so it never sees the regen at all.

## Authenticate the revalidate route

On-demand revalidation is privileged (it purges the cache and forces a
regeneration) — an open endpoint lets anyone DoS the app by repeatedly nuking the
cache. Require a shared secret, the pattern Next.js recommends for CMS webhooks:

- Read `REVALIDATE_SECRET` from the environment; **fail closed** (401) if unset,
  rather than operating unauthenticated.
- Compare the `x-revalidate-token` header in **constant time**.
- In the test, never handle the secret in the spec: load the app's `.env` in
  `playwright.config.ts` (`process.loadEnvFile`) and attach the token via
  `use.extraHTTPHeaders` so every `page.request.*` call carries it automatically.

Source: apps/example-nextjs16/app/isr/page.tsx, app/api/revalidate/route.ts,
e2e/isr.spec.ts, playwright.config.ts
