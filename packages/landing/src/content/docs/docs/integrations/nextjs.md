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
