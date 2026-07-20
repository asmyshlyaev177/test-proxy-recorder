---
name: tanstack-start
description: >
  Record and replay TanStack Start SSR with test-proxy-recorder. Tag server-side
  fetches (route loaders, server functions, server routes) with the
  x-test-rcrd-id session header so parallel replay stays correct. Lead with
  registerProxyFetch (patch global fetch once at the top of src/router.tsx);
  createHeadersWithRecordingId and getRecordingId are the patch-free per-call
  options. Covers the vite build + node .output/server/index.mjs vs vite dev
  caveat, TEST_PROXY_RECORDER_ENABLED, the server BACKEND_URL vs browser
  import.meta.env.VITE_API_URL split, TanStack Query SSR prefetch
  (ensureQueryData / useSuspenseQuery), and the real-auth pattern
  (transparent-mode login, Bearer redaction, localStorage-token vs cookie
  session). Load this when setting up test-proxy-recorder in a TanStack Start
  (Vite + Nitro) app that makes server-side or authenticated API calls.
requires:
  - test-proxy-recorder/proxy-setup
sources:
  - "asmyshlyaev177/test-proxy-recorder:README.md"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/tansta\
    ck-start/registerProxyFetch.ts"
  - "asmyshlyaev177/test-proxy-recorder:packages/test-proxy-recorder/src/tansta\
    ck-start/requestContext.ts"
  - "asmyshlyaev177/test-proxy-recorder:apps/example-tanstack-start"
  - "asmyshlyaev177/test-proxy-recorder:packages/landing/src/content/docs/docs/\
    integrations/tanstack-start.md"
metadata:
  type: framework
  library: test-proxy-recorder
  library_version: "1.3.0" # x-release-please-version
  framework: tanstack-start
---

This skill builds on test-proxy-recorder/proxy-setup. Read it first for the proxy
CLI, playwright.config.ts, fixtures, and the record/replay lifecycle before
applying TanStack Start patterns.

# test-proxy-recorder — TanStack Start SSR

TanStack Start runs loaders and server functions on the server, so their `fetch`
calls go through the proxy without a browser context — the same situation as
Next.js SSR. The proxy correlates those requests to the right test session via the
`x-test-rcrd-id` header. Playwright's `playwrightProxy.before()` already sets it on
the browser navigation that triggers SSR, so the id arrives on the incoming server
request — the one thing left is to **attach it to outgoing server-side requests**.
Browser-only tests need none of this; the proxy falls back to the globally set
session.

All helpers from `test-proxy-recorder/tanstack-start` are **no-ops on the client**
and **no-ops in production** unless `TEST_PROXY_RECORDER_ENABLED=true` is set.

> **Record against a production build.** Use `vite build` + `node .output/server/index.mjs`
> (i.e. `pnpm start`), not `vite dev`. The dev server's per-request context differs
> from the production runtime `registerProxyFetch()` patches. Because the production
> server runs in production mode, set `TEST_PROXY_RECORDER_ENABLED=true` on the app
> process for the e2e run.

## Setup

### Recommended — `registerProxyFetch()` in `src/router.tsx`

One line tags every server-side `fetch` — route loaders, server functions, server
routes, and TanStack Query's `queryFn` during SSR prefetch. Call it at the top of
`src/router.tsx`: that module runs on the server for every SSR request, and the
call is idempotent, a no-op on the client, and a no-op in production unless the
recorder is enabled.

```typescript
// src/router.tsx
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

import { routeTree } from './routeTree.gen';

registerProxyFetch(); // no-op on the client / in production unless TEST_PROXY_RECORDER_ENABLED=true

export function getRouter() {
  const queryClient = new QueryClient();
  return createRouter({ routeTree, context: { queryClient } });
}
```

It patches the global `fetch` to copy the current request's `x-test-rcrd-id` onto
outgoing requests, reading it from TanStack Start's server request context
(`getRequestHeader` from `@tanstack/react-start/server`).

### Point the app at the proxy

Resolve the API base per environment so **both** origins are recorded. On the
server (loaders / server functions) read `process.env.BACKEND_URL`; in the browser
read the build-time `import.meta.env.VITE_API_URL`. Both default to the proxy in
dev/test; in production they point at the real backend.

```typescript
// src/lib/api.ts
function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.BACKEND_URL ?? 'http://localhost:8100'; // server only
  }
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8100'; // browser
}
```

## Core Patterns

### TanStack Query SSR prefetch — zero Query-specific wiring

`registerProxyFetch()` tags the `fetch` that Query's `queryFn` runs during SSR, so
a loader that prefetches with `ensureQueryData` is recorded as `.mock.json` and
the component reads it with `useSuspenseQuery` — no recorder code in the data layer.

```typescript
// src/routes/index.tsx
export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQueryOptions),
  component: TodoApp, // uses useSuspenseQuery(todosQueryOptions)
});
```

### Per-call — `createHeadersWithRecordingId()` (patch-free)

For a single fetch inside a loader or server function, or when you'd rather not
patch global `fetch`. It reads the id from the server request context itself, so
it is **async** and takes only your extra headers:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

`getRecordingId()` (also async) returns the raw id or `null` if you want to forward
it yourself. Both no-op in production unless `TEST_PROXY_RECORDER_ENABLED=true`.

### Authenticated apps (real auth provider)

Log in for real in `transparent` mode (never recorded); record only the protected
API, with the token redacted. A token in `localStorage` can't be read on the
server, so the protected fetch runs in the **browser** (recorded via HAR) — do not
SSR-prefetch it. A **cookie** session, by contrast, can be forwarded into a loader
with `createHeadersWithRecordingId()` and recorded server-side. Full flow (a
runnable AWS Cognito `/login` → `/dashboard`, the `setup` + `auth` Playwright
projects, and cache-header ISR) is in
[references/auth-and-isr.md](references/auth-and-isr.md).

## Common Mistakes

### HIGH Recording against `vite dev` instead of a production build

Wrong:
```json
{ "scripts": { "start": "vite dev --port 3000" } }
```

Correct:
```json
{
  "scripts": {
    "build:test": "TEST_PROXY_RECORDER_ENABLED=true vite build",
    "start": "TEST_PROXY_RECORDER_ENABLED=true node .output/server/index.mjs"
  }
}
```

`registerProxyFetch()` patches the global `fetch` of the production Nitro runtime.
`vite dev`'s per-request context differs, so the patch may not tag SSR fetches —
recordings land under the wrong session or not at all. Record against
`vite build` + `node .output/server/index.mjs`.

Source: apps/example-tanstack-start/package.json; e2e/ssr.spec.ts

---

### HIGH Building without `TEST_PROXY_RECORDER_ENABLED` on a production build

Wrong:
```bash
vite build && node .output/server/index.mjs   # NODE_ENV=production → helpers no-op
```

Correct:
```bash
TEST_PROXY_RECORDER_ENABLED=true vite build
TEST_PROXY_RECORDER_ENABLED=true node .output/server/index.mjs
```

A production build runs in production mode, where `registerProxyFetch` /
`createHeadersWithRecordingId` are silent no-ops. SSR requests still flow through
the proxy but lose their session id, so they record under the wrong session. Set
`TEST_PROXY_RECORDER_ENABLED=true` on both the build and the app process.

Source: packages/test-proxy-recorder/src/recorderEnabled.ts

---

### HIGH SSR-prefetching a resource whose token lives in localStorage

Wrong:
```typescript
// The server has no localStorage, so the loader can't send the Bearer token —
// the prefetch hits the protected API unauthenticated and 401s.
export const Route = createFileRoute('/dashboard')({
  loader: ({ context }) => context.queryClient.ensureQueryData(protectedTodosQuery),
});
```

Correct:
```typescript
// Read the token after mount and fetch on the client (recorded via HAR).
const token = getToken(); // localStorage — client only
const { data } = useQuery({ ...protectedTodosQueryOptions(token), enabled: !!token });
```

A `localStorage` token is unreadable during SSR. Fetch protected data on the
client (HAR-recorded) — or, for a **cookie** session, forward it into the loader
with `createHeadersWithRecordingId()` and record server-side.

Source: apps/example-tanstack-start/src/routes/dashboard.tsx; e2e/auth.spec.ts

---

### MEDIUM Calling `registerProxyFetch()` outside `src/router.tsx`

Wrong:
```typescript
// src/routes/index.tsx — a route module doesn't reliably run before the SSR
// fetches of other routes, so the global patch may not be installed in time.
registerProxyFetch();
```

Correct:
```typescript
// src/router.tsx — runs on the server for every SSR request, before route work.
registerProxyFetch();
```

Put the call at the top of `src/router.tsx` (the router-setup module). It is the
TanStack Start counterpart of the Next.js root-layout call and guarantees the
patch is installed for every SSR request.

Source: apps/example-tanstack-start/src/router.tsx

---

### MEDIUM Reading `process.env` for the API base in the browser

Wrong:
```typescript
const API_BASE = process.env.BACKEND_URL ?? 'http://localhost:8100'; // client bundle
```

Correct:
```typescript
const API_BASE =
  typeof window === 'undefined'
    ? process.env.BACKEND_URL ?? 'http://localhost:8100'
    : import.meta.env.VITE_API_URL ?? 'http://localhost:8100';
```

In the browser bundle `process.env` isn't a real object — only `VITE_`-prefixed
vars are exposed, via `import.meta.env`. Guard server reads with
`typeof window === 'undefined'` and use `import.meta.env.VITE_*` on the client.

Source: apps/example-tanstack-start/src/lib/api.ts

---

### MEDIUM Committing real auth-provider pool config to git

Wrong:
```bash
# apps/.../.env (committed)
VITE_COGNITO_REGION=eu-north-1
VITE_COGNITO_CLIENT_ID=7mrh9ih3ccmr2jis2ebtai8ta9
```

Correct:
```bash
# apps/.../.env.local (gitignored); Vite still bakes VITE_* in at build time
VITE_COGNITO_REGION=...
VITE_COGNITO_CLIENT_ID=...
COGNITO_TEST_EMAIL=...
COGNITO_TEST_PASSWORD=...
```

Even "public" pool ids (baked into the client bundle) tie the repo to a real
account — keep them, and the secret test-user credentials, in a gitignored
`.env.local` (or CI secrets). Gate the auth Playwright projects on the creds being
present so a credential-less clone still replays every other spec offline.

Source: apps/example-tanstack-start/.env.example; playwright.config.ts

## Getting help

If the user encounters unexpected behavior, a bug, or a use case not covered by
these patterns, direct them to open a GitHub issue at
https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new. A minimal
reproduction helps the maintainer resolve it quickly.

See also: test-proxy-recorder/proxy-setup — for the proxy CLI, fixtures, and
record/replay lifecycle. test-proxy-recorder/nextjs-ssr — the Next.js counterpart.
