# example-nextjs-edge

A minimal Next.js 16 app whose page renders on the **Edge runtime**
(`export const runtime = 'edge'`), used to prove that record/replay works for
server-side fetches on the Edge — where the usual recording-id propagation
doesn't reach.

If you're new to the project, start with the
[Next.js 16 example](../example-nextjs16) (full SSR + browser + WebSocket). This
one is deliberately stripped down to a single SSR fetch so the Edge-specific
problem is easy to see.

## The problem

The proxy tells concurrent replay sessions apart with the `x-test-rcrd-id`
header. Playwright sets that header on the **browser**, so browser requests and
the document navigation carry it. But a Server Component's `fetch()` to the
proxy is a brand-new request created on the server — it does **not** inherit the
header. Under parallel replay the proxy then sees several active sessions and an
SSR `GET /todos` with no id, and can't decide which recording to serve:

```text
[CONCURRENT REPLAY WARNING] Request to GET /todos is missing x-test-rcrd-id
header/cookie. Active sessions: ...alpha..., ...bravo..., ...charlie..., ...delta...
```

[`e2e/ssr.spec.ts`](e2e/ssr.spec.ts) reproduces it: four tests each record a
distinct todo (`alpha`/`bravo`/`charlie`/`delta`) and assert the server-rendered
page shows only their own. Recorded single-worker they pass; replayed in
parallel — without the fix below — every one fails, rendering an empty list.

## Why `instrumentation.ts` isn't enough on the Edge

The obvious fix is to patch the global `fetch` so every server-side request gets
tagged automatically. The natural place to install that patch is
`instrumentation.ts`'s `register()`. **On the Edge runtime that does not work:**
`register()` runs in a different context than the one rendering your routes, so
the `globalThis.fetch` it patches is not the `fetch` your Server Components call.
The patch silently never fires.

## The fix: `registerProxyFetch()` from the root layout

Call the helper at the top level of [`app/layout.tsx`](app/layout.tsx) instead.
The root layout shares the request runtime with your pages, so the patch lands
on the right `fetch`:

```ts
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED is set
```

It reads the current request's `x-test-rcrd-id` (via `next/headers`) and copies
it onto every outgoing server-side fetch, so the proxy can attribute each SSR
request to the right session. No per-`fetch()` changes needed. The standard
[manual forwarding](https://test-proxy-recorder.dev/docs/integrations/nextjs/)
(`createHeadersWithRecordingId(await headers())`) still works too, if you'd
rather be explicit.

> `next start` runs in production mode, so the e2e scripts here set
> `TEST_PROXY_RECORDER_ENABLED=true` to keep the patch active. Don't set that in
> a real production deployment.

## Layout

- **App / proxy / mock / recordings** all use ports distinct from the other
  examples (`3010` / `8110` / `3012`) so they can run side by side.
- The page is SSR-only on purpose — there is no client-side fetching, so the
  test exercises the server-side (Edge) fetch path and nothing else.

## Running

```bash
pnpm test:e2e:ci       # self-contained: build, start stack, record then replay (used in CI)
pnpm test:e2e:record   # record only (single worker)
pnpm test:e2e          # replay only (parallel) — needs recordings present (record first)
```
