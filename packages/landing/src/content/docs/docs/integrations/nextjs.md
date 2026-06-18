---
title: Next.js
description: Propagate the recording-session header from Next.js server-side fetches — via middleware (recommended) or manual header forwarding — so SSR requests are recorded and replayed.
---

SSR frameworks like Next.js make server-side `fetch` calls that go through the proxy without a browser context. The proxy identifies which session those requests belong to via the `x-test-rcrd-id` header — the same header `playwrightProxy.before()` sets on the browser `page`. This header is **only required for SSR** — for browser-only tests the proxy falls back to the globally set session automatically.

For SSR requests to carry this header, use one of the following.

## Middleware (recommended)

Next.js 16 uses `proxy.ts` as the middleware entry point (with the exported function named `proxy`). Place it at the project root alongside `next.config.ts`:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

:::note[Next.js 15 and earlier]
The entry point is `middleware.ts` with the function named `middleware` — everything else is identical:

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
:::

## Manual header forwarding

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

See the [API reference](/docs/reference/api/readme/) for the full signatures of the `test-proxy-recorder/nextjs` helpers.

## Edge runtime

Routes that opt into the Edge runtime (`export const runtime = 'edge'`) need one
extra step. The middleware and manual-forwarding approaches above still work, but
if you'd rather tag every server-side `fetch` automatically, call
`registerProxyFetch()` at the top level of your **root layout**:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED is set
```

It patches the global `fetch` to copy the current request's `x-test-rcrd-id` onto
outgoing requests, so the proxy can tell concurrent replay sessions apart. Call
it from the root layout (not `instrumentation.ts`), and remember that `next
start` runs in production mode — set `TEST_PROXY_RECORDER_ENABLED=true` for your
e2e run.

A complete, runnable project lives in the [Edge runtime example](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

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
