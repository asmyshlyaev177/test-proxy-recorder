---
name: nextjs-ssr
description: >
  Wire the x-test-rcrd-id session header through Next.js so server-side fetches
  are recorded under the correct Playwright test session. Covers
  setNextProxyHeaders, createHeadersWithRecordingId, getRecordingId,
  RECORDING_ID_HEADER, middleware.ts (Next.js 13–15), proxy.ts (Next.js 16),
  the React cache() memoization pattern for next/headers, and the axios
  interceptor pattern for SSR requests. Load this skill when setting up
  test-proxy-recorder in a Next.js app that makes server-side API calls.
type: framework
library: test-proxy-recorder
framework: nextjs
library_version: "0.3.5"
requires:
  - test-proxy-recorder/proxy-setup
sources:
  - "asmyshlyaev177/test-proxy-recorder:README.md"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/nextjs/middleware.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-nextjs16"
---

This skill builds on test-proxy-recorder/proxy-setup. Read it first for proxy
CLI setup, playwright.config.ts, and fixtures before applying Next.js patterns.

# test-proxy-recorder — Next.js SSR

The proxy correlates SSR fetches to the right test session via
`x-test-rcrd-id`. Playwright sets this header on the browser page automatically
via `playwrightProxy.before()`. For server-side fetches (SSR, Server
Components, Route Handlers), the header must be explicitly forwarded through
every layer.

All helpers from `test-proxy-recorder/nextjs` are **no-ops in production**
(`NODE_ENV=production`) unless `TEST_PROXY_RECORDER_ENABLED=true` is set.

## Setup

### Next.js 13–15 — middleware.ts

```typescript
// middleware.ts  (Next.js 13–15 — at project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Next.js 16 — proxy.ts

```typescript
// proxy.ts  (Next.js 16 — at project root, alongside next.config.ts)
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

### Axios interceptor for SSR requests

Use this pattern when your app uses axios for server-side API calls instead of
native `fetch`.

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

### HIGH setNextProxyHeaders set but SSR fetches still missing the header

Wrong:
```typescript
// middleware.ts — header set on response, but individual fetch calls don't use it
export function middleware(request) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}

// app/api/data/route.ts — header not forwarded to outgoing fetch
export async function GET() {
  const data = await fetch('http://localhost:8100/api/data');
  return Response.json(await data.json());
}
```

Correct:
```typescript
// app/api/data/route.ts — explicitly inject header into each outgoing fetch
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

export async function GET() {
  const data = await fetch('http://localhost:8100/api/data', {
    headers: createHeadersWithRecordingId(await headers()),
  });
  return Response.json(await data.json());
}
```

`setNextProxyHeaders` makes the session ID available to server components via
`next/headers`. It does **not** automatically inject the header into outgoing
fetch calls — each server-side fetch must use `createHeadersWithRecordingId()`
explicitly.

Source: README.md — Manual header forwarding; channels/web/app/api

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
