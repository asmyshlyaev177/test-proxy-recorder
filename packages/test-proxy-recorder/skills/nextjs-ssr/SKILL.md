---
name: nextjs-ssr
description: >
  Tag server-side fetches with the x-test-rcrd-id session header so SSR is
  recorded under the correct Playwright test session. Lead with
  registerProxyFetch (patch global fetch in the root layout, any runtime) and
  registerProxyAxios (per-axios-instance interceptor); createHeadersWithRecordingId
  is the patch-free per-call option. Covers the build+start vs next dev caveat,
  why the setNextProxyHeaders middleware (proxy.ts / middleware.ts) is optional
  (it only exposes the id, it does not tag fetches), getRecordingId,
  RECORDING_ID_HEADER, the React cache() memoization pattern, and the manual
  axios interceptor. Load this skill when setting up test-proxy-recorder in a
  Next.js app that makes server-side API calls, including Edge-runtime routes.
type: framework
library: test-proxy-recorder
framework: nextjs
library_version: "1.0.1"
requires:
  - test-proxy-recorder/proxy-setup
sources:
  - "asmyshlyaev177/test-proxy-recorder:README.md"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/nextjs/middleware.ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/nextjs/registerProxyFetch.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-nextjs16"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-nextjs-edge"
---

This skill builds on test-proxy-recorder/proxy-setup. Read it first for proxy
CLI setup, playwright.config.ts, and fixtures before applying Next.js patterns.

# test-proxy-recorder — Next.js SSR

The proxy correlates SSR fetches to the right test session via the
`x-test-rcrd-id` header. Playwright sets it on **every browser request** (via
`playwrightProxy.before()`), including the navigation that triggers SSR — so the
id is already in the server render scope (`next/headers`). The one thing left to
do is **attach it to outgoing server-side fetches**. A middleware
(`setNextProxyHeaders`) only *exposes* the id; it does **not** tag fetches, so
one of the helpers below is required (the middleware itself is optional — see the
end of Setup).

All helpers from `test-proxy-recorder/nextjs` are **no-ops in production**
(`NODE_ENV=production`) unless `TEST_PROXY_RECORDER_ENABLED=true` is set.

> **Record against a production build** (`next build && next start`), not
> `next dev`. The dev server could reset a global `fetch` patch on subsequent
> requests ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596),
> fixed in newer versions); build+start has no such issue and is faster/less flaky.

## Setup

### Recommended — `registerProxyFetch()` in the root layout (any runtime)

One line tags every server-side `fetch` (Server Components, Route Handlers, Node
**and** Edge runtimes). Call it at the top level of the root layout — not
`instrumentation.ts` (see Common Mistakes).

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### axios SSR calls — `registerProxyAxios(instance)`

For apps whose server-side requests go through axios, register each server-side
instance once. It adds a request interceptor that stamps the id, and never
touches global `fetch`, so it's immune to the dev-mode patch caveat.

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
registerProxyAxios(axiosWithAuth);
```

Replaces the hand-rolled interceptor + `React.cache()` helper (still documented
below for reference). No-op in production / in the browser; idempotent per
instance; never overwrites a caller-set id.

### Per-call alternative — `createHeadersWithRecordingId()`

Patch-free and works under `next dev` too (reads the id from `headers()`
directly). Use it when you'd rather not patch global `fetch`, or for one fetch:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  cache: 'no-store',
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

### Optional — middleware (`setNextProxyHeaders`)

A `proxy.ts` (Next.js 16+, exported `proxy`) / `middleware.ts` (15 and earlier,
exported `middleware`) calling `setNextProxyHeaders` makes the id available via
`next/headers`, but **does not tag outgoing fetches** — so it is not required
when you use a helper above. Reach for it only if you already own a middleware
for other reasons (auth, etc.); still pair it with a helper above to do the
actual tagging.

```typescript
// proxy.ts (Next.js 16+) — exported `proxy`; use middleware.ts / `middleware` on 15 and earlier
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

## Core Patterns

### Inject recording ID into native fetch (Route Handler / Server Component)

```typescript
// app/api/data/route.ts
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

export async function GET(request: Request) {
  const res = await fetch('http://localhost:8100/api/data', {
    cache: 'no-store',
    headers: createHeadersWithRecordingId(await headers(), {
      'Content-Type': 'application/json',
    }),
  });
  return Response.json(await res.json());
}
```

`createHeadersWithRecordingId` merges the session ID into your headers object.
It is a no-op when the session ID is absent (browser-only tests, or production).

### `registerProxyFetch` — detail

Set up in Setup above. It reads the id via `next/headers`, so it only acts
inside a request scope and leaves build-time/non-request fetches untouched. It
tags every server-side fetch (the id is inert anywhere but the proxy and never
affects replay matching, and during tests everything you record routes through
the proxy anyway). Works on Node **and** Edge runtimes. Call it from the root
layout, **not** `instrumentation.ts` (see Common Mistakes).
Source: apps/example-nextjs-edge/app/layout.tsx

### Testing a cached / ISR route

**Don't disable caching for tests** — record/replay works with ISR, but only one
design is deterministic. The rule: replaying an SSR fetch needs the page to run
that fetch at request time, so cache it with fetch-level `next.revalidate` +
`next.tags` (a hard purge on `revalidateTag`), **not** `unstable_cache` (which is
stale-while-revalidate and flakes). Before the replay navigation, `revalidateTag`
to drop the cache left from the record phase; one navigation is then enough — no
polling. During tests the patched fetch reads `headers()`, so the page renders
dynamically and runs the fetch; in production it's still static ISR. Gate the
revalidate route behind a secret (privileged, DoS-able) supplied via Playwright
`extraHTTPHeaders`.

Full rationale, the flaky approaches to avoid, and the auth pattern are in
[references/caching-and-isr.md](references/caching-and-isr.md).
Source: apps/example-nextjs16/app/isr/page.tsx, app/api/revalidate/route.ts, e2e/isr.spec.ts

### Memoize header lookup with React cache() (App Router)

Avoid calling `headers()` in every individual fetch helper. Wrap it once with
`React.cache()` so it is called once per request and shared across all
server-side imports.

```typescript
// lib/recording-id.ts
import { cache } from 'react';
import { RECORDING_ID_HEADER } from 'test-proxy-recorder/nextjs';

export const getServerRecordingId = cache(async () => {
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    return headersList.get(RECORDING_ID_HEADER.toLowerCase()) || undefined;
  } catch {
    return undefined; // Not in a Server Component request context
  }
});
```

### Axios interceptor for SSR requests (manual)

**Prefer `registerProxyAxios(instance)` (Setup)** — it does exactly this. Use the
manual interceptor below only if you need custom logic around it. It also shows
the `React.cache()` helper (above) in context.

```typescript
// lib/axios-server.ts
import axios from 'axios';
import { RECORDING_ID_HEADER } from 'test-proxy-recorder/nextjs';
import { getServerRecordingId } from './recording-id';

const isTestMode = process.env.NODE_ENV !== 'production';

export const axiosForServer = axios.create();

axiosForServer.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined' && isTestMode) {
    try {
      const recordingId = await getServerRecordingId();
      if (recordingId) {
        config.headers.set(RECORDING_ID_HEADER, recordingId);
      }
    } catch {
      // Not in a Server Component context — silently skip
    }
  }
  return config;
});
```

### Extract recording ID manually

```typescript
import { getRecordingId, RECORDING_ID_HEADER } from 'test-proxy-recorder/nextjs';
import { headers } from 'next/headers';

// From headers() in a Server Component
const recordingId = getRecordingId(await headers());

// From NextRequest in middleware
const recordingId = getRecordingId(request.headers);

// Forward manually
if (recordingId) {
  requestHeaders.set(RECORDING_ID_HEADER, recordingId);
}
```

## Common Mistakes

### HIGH Using middleware.ts (or a middleware export) in Next.js 16

Wrong:
```typescript
// middleware.ts — ignored in Next.js 16, session header never forwarded
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';
export function middleware(request) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}
```

Correct:
```typescript
// proxy.ts — Next.js 16 middleware entry point, at project root
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';
export function proxy(request) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Next.js 16 replaced `middleware.ts` with `proxy.ts` as the middleware entry
point, and the exported function is named `proxy`, not `middleware`. Keeping
either old name silently does nothing — the session header is never forwarded
and all SSR recordings are grouped under the wrong session.

Source: apps/example-nextjs16/proxy.ts

---

### HIGH Patching fetch from instrumentation.ts on the Edge runtime

Wrong:
```typescript
// instrumentation.ts — register() runs in a different context than the one
// rendering Edge routes, so this globalThis.fetch is NOT the one your Server
// Components call. The patch silently never fires; SSR fetches stay untagged.
export async function register() {
  const { registerProxyFetch } = await import('test-proxy-recorder/nextjs');
  registerProxyFetch();
}
```

Correct:
```typescript
// app/layout.tsx — the root layout shares the request runtime with your pages,
// so the patch lands on the fetch the Edge route actually uses.
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

On the Edge runtime, `instrumentation.ts`'s `register()` runs in a separate
context from route rendering, so a `globalThis.fetch` patch installed there does
not affect Server Component fetches. Call `registerProxyFetch()` from the root
layout instead. Also remember that `next start` runs in production mode, so set
`TEST_PROXY_RECORDER_ENABLED=true` on the app process or the patch is a no-op.

Source: apps/example-nextjs-edge/app/layout.tsx; packages/test-proxy-recorder/src/nextjs/registerProxyFetch.ts

---

### HIGH Relying on the middleware alone to tag SSR fetches

Wrong:
```typescript
// proxy.ts / middleware.ts only — nothing actually tags the outgoing fetch
export function proxy(request) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}
// app/page.tsx — bare SSR fetch, no helper
const data = await fetch('http://localhost:8100/api/data');
```

Correct — add one of the forwarding helpers (Setup):
```typescript
// app/layout.tsx — tags every server-side fetch
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
registerProxyFetch();
// (axios apps: registerProxyAxios(instance); or per-call createHeadersWithRecordingId)
```

`setNextProxyHeaders` only *exposes* the id via `next/headers`; it does **not**
inject it into outgoing fetch/axios calls. With middleware alone, SSR requests go
out untagged and **parallel replay fails** — the proxy can't tell which session a
request belongs to (verified: middleware-only → fail; `registerProxyFetch`-only,
no middleware → pass, on both Node and Edge runtimes). The middleware is optional;
a forwarding helper is what's required.

Source: experiment in repo TODO.md; apps/example-nextjs-edge

---

### HIGH Recording against a production build without TEST_PROXY_RECORDER_ENABLED

Wrong:
```json
{
  "scripts": {
    "start:proxy": "concurrently \"pnpm proxy\" \"INTERNAL_API_URL=http://localhost:8100 next start\""
  }
}
```

Correct:
```json
{
  "scripts": {
    "start:proxy": "concurrently \"pnpm proxy\" \"INTERNAL_API_URL=http://localhost:8100 TEST_PROXY_RECORDER_ENABLED=true next start\""
  }
}
```

Recording should run against a production build (`next build && next start` —
see proxy-setup), but `next build` sets `NODE_ENV=production`, which turns
`setNextProxyHeaders` and `createHeadersWithRecordingId` into silent no-ops.
SSR requests still flow through the proxy but lose their session ID, so they
are recorded under the wrong session — or not at all. Set
`TEST_PROXY_RECORDER_ENABLED=true` on the app process whenever testing a
production build.

Source: packages/test-proxy-recorder/src/nextjs/middleware.ts — isRecorderEnabled()

---

### MEDIUM Importing next/headers at module level in an axios interceptor

Wrong:
```typescript
import { headers } from 'next/headers'; // throws when evaluated on the client

axiosForServer.interceptors.request.use(async (config) => {
  const id = (await headers()).get('x-test-rcrd-id');
  config.headers.set('x-test-rcrd-id', id);
  return config;
});
```

Correct:
```typescript
axiosForServer.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined' && isTestMode) {
    try {
      const { getServerRecordingId } = await import('./recording-id');
      const recordingId = await getServerRecordingId();
      if (recordingId) config.headers.set(RECORDING_ID_HEADER, recordingId);
    } catch {
      // Not in a Server Component context — silently skip
    }
  }
  return config;
});
```

`next/headers` throws when imported outside a Server Component request context
(including on the client). Always lazy-import it inside the interceptor, guard
with `typeof window === 'undefined'`, and wrap in try/catch.

Source: channels/web/core/api/axios.ts

---

### MEDIUM Calling headers() on every SSR fetch instead of caching per request

Wrong:
```typescript
// Called independently in each server utility — redundant async header reads
async function fetchUsers() {
  const { headers } = await import('next/headers');
  const id = (await headers()).get('x-test-rcrd-id');
  return fetch(url, { headers: { 'x-test-rcrd-id': id ?? '' } });
}
async function fetchPosts() {
  const { headers } = await import('next/headers');
  const id = (await headers()).get('x-test-rcrd-id');
  return fetch(url2, { headers: { 'x-test-rcrd-id': id ?? '' } });
}
```

Correct:
```typescript
// lib/recording-id.ts — memoized once per request via React cache()
import { cache } from 'react';
import { RECORDING_ID_HEADER } from 'test-proxy-recorder/nextjs';
export const getServerRecordingId = cache(async () => { /* ... */ });

// Each utility reuses the cached value
async function fetchUsers() {
  const id = await getServerRecordingId();
  return fetch(url, { headers: id ? { [RECORDING_ID_HEADER]: id } : {} });
}
```

Wrap the `headers()` call in `React.cache()` once. The memoized function is
called once per server request regardless of how many fetch utilities invoke it.

Source: channels/web/lib/recording-id.ts

---

### MEDIUM Manually setting header without production guard

Wrong:
```typescript
// No production guard — leaks session IDs in prod if env var is misconfigured
response.headers.set('x-test-rcrd-id', request.headers.get('x-test-rcrd-id') ?? '');
```

Correct:
```typescript
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';
setNextProxyHeaders(request, response); // automatically skips in production
```

Use the library helpers instead of manually reading/setting `x-test-rcrd-id`.
`setNextProxyHeaders` and `createHeadersWithRecordingId` both check
`NODE_ENV !== 'production'` (or `TEST_PROXY_RECORDER_ENABLED`) and are no-ops
when the guard fails.

Source: packages/test-proxy-recorder/src/nextjs/middleware.ts — isRecorderEnabled()

See also: test-proxy-recorder/proxy-setup — for proxy CLI, fixtures, and record/replay lifecycle
