---
title: Next.js
description: Tag Next.js server-side fetches with the recording-session header so SSR is recorded and replayed — via registerProxyFetch (recommended, any runtime), registerProxyAxios for axios, or createHeadersWithRecordingId per call. The middleware is optional.
---

SSR frameworks like Next.js make server-side `fetch` calls that go through the proxy without a browser context. The proxy identifies which session those requests belong to via the `x-test-rcrd-id` header. Playwright's `playwrightProxy.before()` already sets it on the browser navigation that triggers SSR, so the id is available in `next/headers` — the job is to **attach it to outgoing server-side requests**. (Browser-only tests need none of this; the proxy falls back to the globally set session.)

:::tip
[`test-proxy-recorder init`](/docs/getting-started/quick-start/) detects Next.js and wires the recommended approach below into your root layout automatically.
:::

:::caution[Record against a production build]
Record with `next build && next start`, not `next dev`. The dev server can reset the global `fetch` patch between requests ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), and is slower/flakier. Since `next start` runs in production mode, set `TEST_PROXY_RECORDER_ENABLED=true` on the app process for your e2e run.
:::

## registerProxyFetch (recommended)

One line in your **root layout** tags every server-side `fetch` — Server Components, Route Handlers, on the Node **and** Edge runtimes:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true
```

It patches the global `fetch` to copy the current request's `x-test-rcrd-id` onto outgoing requests, so the proxy can tell concurrent replay sessions apart. Call it from the root layout — **not** `instrumentation.ts`, whose context differs from the one rendering your routes on the Edge runtime, so a patch there silently never fires.

## axios — registerProxyAxios

If your server-side requests go through axios, register each server-side instance once:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

It adds a request interceptor that stamps the id (never touching global `fetch`), so it's immune to the dev-server caveat above. No-op in production / in the browser; idempotent per instance; never overwrites a caller-set id.

## Per-call — createHeadersWithRecordingId

Patch-free, and works under `next dev` too. Use it for a single fetch, or when you'd rather not patch global `fetch`:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (optional)

A `proxy.ts` (Next.js 16+, exported `proxy`) or `middleware.ts` (15 and earlier, exported `middleware`) calling `setNextProxyHeaders` makes the id available via `next/headers`, but **does not tag outgoing fetches** — so it is not required when you use one of the helpers above. Reach for it only if you already own a middleware (auth, etc.), and still pair it with a helper to do the tagging:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // exposes the id; pair with a helper above
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

See the [API reference](/docs/reference/api/readme/) for the full signatures of the `test-proxy-recorder/nextjs` helpers. A complete, runnable Edge project lives in the [Edge runtime example](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

## Caching & ISR

Don't disable caching for tests — the recorder works with a cached/ISR route. But there's one rule that decides the whole design: **to replay an SSR fetch, the page must run that fetch at request time.** A route that serves prerendered HTML or a stale cached render never makes the fetch, so the proxy has nothing to serve and the assertion sees stale content.

The way that stays deterministic is to cache the SSR fetch with fetch-level `next.revalidate` + `next.tags`, then invalidate on demand before the assertion:

```tsx
// app/isr/page.tsx — no `export const dynamic`, no `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('todos', 'max'); // Next.js 16 requires the 2nd profile arg
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // hard purge
await page.goto('/isr');                     // one navigation — deterministic
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

`revalidateTag` on a **fetch** cache entry is a *hard purge*: the next read is a cache miss that blocks and re-fetches through the proxy. You must purge before the replay navigation because the data cache survives across the record → replay phases of one `next start` process — otherwise replay serves the record-phase cache and never hits the proxy (a false pass).

During tests the patched `fetch` reads `headers()`, so the page renders dynamically and actually runs the fetch. In production (recorder disabled) nothing reads `headers()` and the page is static ISR as usual — the dynamic render is scoped to tests, and is intrinsic to recording an SSR fetch.

:::caution[Avoid `unstable_cache` for this]
`unstable_cache` is *stale-while-revalidate*: `revalidateTag` marks its entry stale, the next read returns the stale value and regenerates in the **background**, so the fresh value lands after your assertion — flaky, even on a `force-dynamic` page and even with a warm-up request. Use fetch-level `next.tags` (a hard purge) instead.
:::

On-demand revalidation is privileged (it purges the cache and forces regeneration), so gate the route behind a shared secret — fail closed if it's unset, compare in constant time, and attach the token from the test via Playwright `use.extraHTTPHeaders` so the spec never handles it.

See the full, runnable example (part of the [Next.js 16 example](/docs/reference/examples/#nextjs-16)):

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — the cached page (fetch-level `next.tags`)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — how to guard `revalidateTag`: fail-closed + constant-time secret compare
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — invalidate, then one navigation; asserts the revalidate call succeeded
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — loads `.env` and attaches the secret via `extraHTTPHeaders`

## package.json scripts

Start services from scripts, not from `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

A complete, runnable project lives in the [Next.js 16 example](/docs/reference/examples/#nextjs-16).
