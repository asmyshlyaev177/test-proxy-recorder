---
title: TanStack Start
description: Tag TanStack Start server-side fetches with the recording-session header so SSR is recorded and replayed — via registerProxyFetch (recommended) or createHeadersWithRecordingId per call.
---

TanStack Start runs loaders and server functions on the server, so their `fetch` calls go through the proxy without a browser context — the same situation as [Next.js SSR](/docs/integrations/nextjs/). The proxy identifies which session those requests belong to via the `x-test-rcrd-id` header. Playwright's `playwrightProxy.before()` already sets it on the browser navigation that triggers SSR, so the id arrives on the incoming server request — the job is to **attach it to outgoing server-side requests**. (Browser-only tests need none of this; the proxy falls back to the globally set session.)

:::caution[Record against a production build]
Record with `vite build` + `node .output/server/index.mjs` (i.e. `pnpm start`), not `vite dev`. The dev server's per-request context differs from the production runtime `registerProxyFetch()` patches. Since the production server runs in production mode, set `TEST_PROXY_RECORDER_ENABLED=true` on the app process for your e2e run.
:::

## registerProxyFetch (recommended)

One line in your **router setup** tags every server-side `fetch` — route loaders, server functions, and server routes:

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // no-op on the client / in production unless TEST_PROXY_RECORDER_ENABLED=true
```

It patches the global `fetch` to copy the current request's `x-test-rcrd-id` onto outgoing requests, reading it from TanStack Start's server request context (`getRequestHeader`). Put it at the top of `src/router.tsx` — that module runs on the server for every SSR request, and the call is idempotent, a no-op on the client, and a no-op in production unless the recorder is explicitly enabled.

## Per-call — createHeadersWithRecordingId

Patch-free. Use it for a single fetch inside a loader or server function, or when you'd rather not patch global `fetch`:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

`getRecordingId()` is also exported if you want the raw id (or `null`) to forward yourself. Both read the current request's id from the server context, and both no-op in production unless `TEST_PROXY_RECORDER_ENABLED=true`.

## Point the app at the proxy

In dev/test, point your backend base URLs at the proxy so **both** origins are recorded — the server-side base (read by loaders/server functions, e.g. `BACKEND_URL`) and the browser-side base baked in at build (`VITE_API_URL`). In production, point them at the real backend. Browser-side requests are handled by `playwrightProxy.before()`'s HAR mechanism, exactly as in the [manual setup](/docs/getting-started/manual-setup/).

## Full example

A complete, runnable app — built with **TanStack Query** (SSR prefetch + `useMutation`), covering todos (browser + SSR), a cache-header ISR route, a redaction case, and WebSocket chat, all recorded and replayed — lives in [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). It shows the recorder is transparent to your data layer: `registerProxyFetch()` tags Query's `queryFn` fetches during SSR with no Query-specific code.
