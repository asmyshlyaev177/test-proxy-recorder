# Example: Next.js 16 (server-side + browser recording)

A full-stack example of using [test-proxy-recorder](../../packages/test-proxy-recorder) to test a
**Next.js 16** app end-to-end without a live backend on CI.

The app is a todo list that talks to an API from **two** places:

- **Server-side** — the page (`app/page.tsx`) fetches the initial list during SSR.
- **Browser-side** — the client component (`app/components/TodoApp.tsx`) adds, edits,
  toggles, and deletes todos via `fetch`.

This example records and replays **both**, using both of the library's mechanisms at once:

```text
                         Record mode                          Replay mode

  Next.js SSR  ──fetch──> Proxy ──> Mock backend     Next.js SSR  ──fetch──> Proxy ──> .mock.json
  Browser      ──fetch──> Proxy ──> Mock backend     Browser      ──fetch──> Proxy ──> .har
                            │
                            └──> .mock.json (server-side)
                                 .har         (browser-side)
```

Three services are involved:

| Service | Port | Role |
| ------- | ---- | ---- |
| Mock backend | 3002 | Stands in for the "real" API. Only used in record mode. |
| Proxy (`test-proxy-recorder`) | 8100 | Records/replays traffic. Both SSR and browser point here. |
| Next.js | 3000 | The app under test. |

## Prerequisites

- **Node + pnpm**, with workspace deps installed (`pnpm install` at the repo root).

No `.env` is needed for testing: both `BACKEND_URL` (SSR) and `NEXT_PUBLIC_API_URL`
(browser) default to the proxy at `http://localhost:8100`. `.env.example` only
matters when pointing the app at a real backend in production.

## Quick start — replay

```bash
pnpm test:e2e
```

This one command is self-contained: it builds the app, starts all three services,
runs the Playwright tests in replay mode (served entirely from
[`e2e/recordings/`](e2e/recordings/)), and tears everything down. No network and no
backend are needed.

> **Recordings are not committed to git.** A fresh clone has an empty
> `e2e/recordings/`, so replay has nothing to serve until you record once — see
> below.

## Record your own

Recording hits the **real** API (here, the local mock backend) and saves the
traffic to disk so future replay runs are offline and deterministic.

In one terminal, start the services:

```bash
pnpm start:all          # mock backend (3002) + proxy (8100) + Next.js (3000)
```

In another, record:

```bash
pnpm test:e2e:record    # RECORD_MODE=1, opens the Playwright UI
```

Every test's requests are written to `e2e/recordings/` — a `.mock.json` for the
server-side SSR fetch and a `.har` for the browser-side calls. Switch back to
`pnpm test:e2e` to run offline from those recordings.

## How recording works

The interesting part of this example is that two different request origins are
captured by two different mechanisms, keyed to the same test:

- **Browser → `.har`.** [`e2e/todos.spec.ts`](e2e/todos.spec.ts) calls
  `playwrightProxy.before(page, testInfo, mode, { url: /localhost:8100/ })`, which
  uses Playwright's HAR intercept to record/replay the browser's `fetch` calls.
- **SSR → `.mock.json`.** The proxy records server-side requests itself. For the
  proxy to associate an SSR fetch with the right test, the per-test recording-id
  header must travel from the incoming page request to the outgoing SSR fetch —
  that is exactly what the middleware in [`proxy.ts`](proxy.ts) does via
  `setNextProxyHeaders`.
- **`mode`** is `record` when `RECORD_MODE` is set, otherwise `replay`
  ([`e2e/todos.spec.ts`](e2e/todos.spec.ts)).
- Each test calls `resetData()` first (a `DELETE /todos` to the mock backend) so
  recordings start from a known-empty state.

## Files

| File | Purpose |
| ---- | ------- |
| [`app/page.tsx`](app/page.tsx) | Server component; SSR-fetches the initial todo list from `BACKEND_URL`. |
| [`app/components/TodoApp.tsx`](app/components/TodoApp.tsx) | Client component; browser `fetch` to `NEXT_PUBLIC_API_URL` for mutations. |
| [`proxy.ts`](proxy.ts) | Next.js middleware; forwards the recording-id header to SSR fetches so the proxy can key server-side recordings per test. |
| [`mock-backend/server.mjs`](mock-backend/server.mjs) | Standalone Node HTTP API (port 3002) backed by [`data/todos.json`](data/todos.json) — the "real" backend in record mode. |
| [`e2e/todos.spec.ts`](e2e/todos.spec.ts) | The tests; wires `playwrightProxy.before` for record/replay. |
| [`playwright.config.ts`](playwright.config.ts) | Playwright config. Services are started externally (via `start:all`), not by a `webServer`. |
| [`.env.example`](.env.example) | Env template — proxy URLs for dev/test, real backend for production. |
| `e2e/recordings/` | Recorded `.mock.json` / `.har` traffic. **Not committed** — record your own. |

## Adapting this to your own app

- **Point the app at the proxy in dev/test** — set `BACKEND_URL` (SSR) and
  `NEXT_PUBLIC_API_URL` (browser) to the proxy's address so both request origins
  are recorded; in production, point them at the real backend. See
  [`.env.example`](.env.example).
- **Keep the middleware** — [`proxy.ts`](proxy.ts) is what makes server-side
  recording work; without it, SSR fetches can't be keyed to a test.
- **Match your API origin** — the `CLIENT_SIDE_URL` regex in
  [`e2e/todos.spec.ts`](e2e/todos.spec.ts) decides which browser requests are
  recorded/replayed.
- **Browser-only app?** If your app never fetches from the server, you don't need
  the middleware or the `.mock.json` side — see the
  [Chrome extension example](../example-extension) for the HAR-only setup.
