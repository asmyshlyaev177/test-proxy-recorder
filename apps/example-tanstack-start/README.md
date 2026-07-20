# Example: TanStack Start (server-side + browser recording)

A full-stack example of using [test-proxy-recorder](../../packages/test-proxy-recorder) to test a
**TanStack Start** app end-to-end without a live backend on CI.

The data layer is **TanStack Query** — the idiomatic choice for a TanStack app —
and the todo list talks to an API from **two** places:

- **Server-side** — the home route's loader prefetches the list into the
  `QueryClient` during SSR (`src/routes/index.tsx`), which is dehydrated to the
  client.
- **Browser-side** — the component (`src/components/TodoApp.tsx`) reads it with
  `useSuspenseQuery` and adds/edits/toggles/deletes via `useMutation`.

> **The recorder is data-layer-agnostic.** It works at the HTTP layer, so nothing
> here is Query-specific: `useMutation`/`queryFn` calls bottom out in `fetch`,
> which the browser records via HAR and the server tags via `registerProxyFetch`.
> The exact same setup works with plain `fetch` or axios — Query needs no special
> wiring.

This example records and replays **both** origins, using both of the library's mechanisms at once:

```text
                          Record mode                          Replay mode

  SSR prefetch ─fetch─> Proxy ──> Mock backend    SSR prefetch ─fetch─> Proxy ──> .mock.json
  Browser      ─fetch─> Proxy ──> Mock backend    Browser      ─fetch─> Proxy ──> .har
                          │
                          └──> .mock.json (server-side)
                               .har         (browser-side)
```

Three services are involved:

| Service | Port | Role |
| ------- | ---- | ---- |
| Mock backend | 3002 | Stands in for the "real" API. Only used in record mode. |
| Proxy (`test-proxy-recorder`) | 8100 | Records/replays traffic. Both SSR and browser point here. |
| TanStack Start (Nitro) | 3000 | The app under test. |

## Prerequisites

- **Node + pnpm**, with workspace deps installed (`pnpm install` at the repo root).

No `.env` is needed for testing: both `BACKEND_URL` (SSR) and `VITE_API_URL`
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
pnpm start:all          # mock backend (3002) + proxy (8100) + TanStack app (3000)
```

In another, record:

```bash
pnpm test:e2e:record    # RECORD_MODE=1, opens the Playwright UI
```

Every test's requests are written to `e2e/recordings/` — a `.mock.json` for the
server-side SSR fetch and a `.har` for the browser-side calls. Switch back to
`pnpm test:e2e` to run offline from those recordings.

> **Record against a production build, not `vite dev`.** The scripts build the app
> (`vite build`) and start the Nitro server (`node .output/server/index.mjs`), the
> same as `pnpm start`. `registerProxyFetch()` patches the server `fetch` in that
> runtime — dev mode's request context differs.

## How recording works

The interesting part of this example is that two different request origins are
captured by two different mechanisms, keyed to the same test:

- **Browser → `.har`.** [`e2e/todos.spec.ts`](e2e/todos.spec.ts) calls
  `playwrightProxy.before(page, testInfo, mode, { url: /localhost:8100/ })`, which
  uses Playwright's HAR intercept to record/replay the browser's `fetch` calls.
- **SSR → `.mock.json`.** The proxy records server-side requests itself. For the
  proxy to associate an SSR fetch with the right test, the per-test recording-id
  header (`x-test-rcrd-id`) must travel from the incoming page request to the
  outgoing SSR fetch — that is exactly what
  [`registerProxyFetch()`](../../packages/test-proxy-recorder/src/tanstack-start/registerProxyFetch.ts)
  in [`src/router.tsx`](src/router.tsx) does. It patches the server `fetch` to read
  the current request's id (via TanStack Start's `getRequestHeader`) and forward it
  — which transparently tags the `fetch` that TanStack Query's loader prefetch
  runs during SSR, so the data layer needs no recorder-specific code.
- **`mode`** is `record` when `RECORD_MODE` is set, otherwise `replay`.
- Each test calls `resetData()` first (a `DELETE /todos` to the mock backend) so
  recordings start from a known-empty state.

## Files

| File | Purpose |
| ---- | ------- |
| [`src/routes/index.tsx`](src/routes/index.tsx) | Home route; loader prefetches the todos query on the server (SSR), dehydrated to the client. |
| [`src/components/TodoApp.tsx`](src/components/TodoApp.tsx) | Reads the list with `useSuspenseQuery`; add/edit/toggle/delete via `useMutation`. |
| [`src/lib/api.ts`](src/lib/api.ts) | The API client — `fetch` calls with an env-aware base (`BACKEND_URL` on the server, `VITE_API_URL` in the browser). |
| [`src/queries.ts`](src/queries.ts) | Shared TanStack Query `queryOptions` used by both the SSR loader and the components. |
| [`src/router.tsx`](src/router.tsx) | Creates the `QueryClient` + SSR-query integration, and calls `registerProxyFetch()` so SSR fetches carry the recording-id header — the TanStack Start counterpart of the Next.js `app/layout.tsx` call. |
| [`src/routes/isr.tsx`](src/routes/isr.tsx) | Cache-header (CDN) ISR route; a Query prefetch proves the recorder coexists with a cached route. |
| [`src/routes/secret.tsx`](src/routes/secret.tsx) | Client `useQuery` carrying an `Authorization` header + secret response — exercises redaction. |
| [`src/routes/websocket.tsx`](src/routes/websocket.tsx) | WebSocket chat; traffic recorded server-side in `.mock.json`. |
| [`src/routes/api/revalidate.ts`](src/routes/api/revalidate.ts) | Token-authenticated server route for on-demand ISR revalidation (CDN purge in prod). |
| [`mock-backend/server.mjs`](mock-backend/server.mjs) | Standalone Node HTTP + WebSocket API (port 3002) — the "real" backend in record mode. |
| [`test-proxy-recorder.config.ts`](test-proxy-recorder.config.ts) | Proxy config (target/port/recordingsDir/redaction). |
| [`playwright.config.ts`](playwright.config.ts) | Playwright config. Services are started externally (via `start:all`), not by a `webServer`. |
| [`.env.example`](.env.example) | Env template — proxy URLs for dev/test, real backend for production. |
| `e2e/recordings/` | Recorded `.mock.json` / `.har` traffic. **Not committed** — record your own. |

## Authenticated dashboard (AWS Cognito)

The `/login` → `/dashboard` routes add a **real auth provider** on top of the same
recorder setup, mirroring [`example-auth-cognito`](../example-auth-cognito) but in
TanStack Start idioms. An authenticated app has two kinds of traffic that need
opposite treatment:

| Traffic | Mode | Why |
| ------- | ---- | --- |
| **Login** (credentials → Cognito JWT) | `transparent` | Must never land in a committed recording. |
| **Protected app data** (`/protected/todos`) | `record` / `replay` | This is what we want to test offline. |

The flow:

1. A Playwright **`setup` project** ([`e2e/setup-auth.ts`](e2e/setup-auth.ts)) logs
   in **once** with the proxy in `transparent` mode and saves `storageState` (the
   Cognito access token in `localStorage`) to a gitignored `e2e/auth-state.json`.
   The login hits real Cognito on a different host than the proxy, so it's never recorded.
2. The **`auth` project** ([`e2e/auth.spec.ts`](e2e/auth.spec.ts)) loads that
   `storageState` and starts already authenticated. Its protected requests carry
   the JWT as a Bearer header and run in `record`/`replay`.
3. The recorder **redacts** the `Authorization` header, so no token reaches the
   recordings. [`e2e/assert-redactions.mjs`](e2e/assert-redactions.mjs) enforces
   this — it fails if any JWT survives, or if the login flow produced a recording.

Because the Cognito token lives in the browser's `localStorage`, the protected list
is **not** SSR-prefetched (unlike the public home page): the fetch runs client-side
and is recorded via HAR — the same mechanism as [`/secret`](src/routes/secret.tsx).

### Running it

The auth suite needs a real Cognito user pool, so it's **opt-in**. Nothing about
the pool is committed — put it all in the gitignored `.env.local`:

```bash
cp .env.example .env.local     # then fill the four VITE_COGNITO_* / COGNITO_TEST_* vars
pnpm test:e2e:ci               # records (real Cognito + backend) then replays
```

`.env.local` holds both the public pool config (`VITE_COGNITO_REGION` /
`VITE_COGNITO_CLIENT_ID`, baked into the client bundle at build time) and the secret
test-user credentials — kept out of git so the demo isn't tied to a real pool.
Without them the `setup` and `auth` projects are **skipped** and every other spec
still records/replays exactly as before — so a fresh clone (and forks without
secrets) stay green. In CI, supply all four as Actions secrets.

| File | Purpose |
| ---- | ------- |
| [`src/lib/auth.ts`](src/lib/auth.ts) | Cognito `InitiateAuth` sign-in + `localStorage` token plumbing. |
| [`src/routes/login.tsx`](src/routes/login.tsx) | Sign-in form; stores the token and redirects to the dashboard. |
| [`src/routes/dashboard.tsx`](src/routes/dashboard.tsx) | Protected route; reads the token (client-only), bounces to `/login` if absent. |
| [`src/components/ProtectedTodoApp.tsx`](src/components/ProtectedTodoApp.tsx) | TanStack Query UI for the protected list — `useQuery` + `useMutation`, Bearer header. |
| [`e2e/setup-auth.ts`](e2e/setup-auth.ts) | Logs in once (transparent mode), saves `storageState`. |
| [`e2e/auth.spec.ts`](e2e/auth.spec.ts) | Pre-authenticated dashboard specs (record/replay). |

## Adapting this to your own app

- **Point the app at the proxy in dev/test** — set `BACKEND_URL` (SSR) and
  `VITE_API_URL` (browser) to the proxy's address so both request origins are
  recorded; in production, point them at the real backend. See
  [`.env.example`](.env.example).
- **Call `registerProxyFetch()` once** — the top of
  [`src/router.tsx`](src/router.tsx) is the natural place; it runs on the server for
  every SSR request. Without it, SSR fetches can't be keyed to a test. If you'd
  rather forward the id by hand, use `createHeadersWithRecordingId()` /
  `getRecordingId()` from `test-proxy-recorder/tanstack-start` inside a loader or
  server function.
- **Match your API origin** — the `CLIENT_SIDE_URL` regex in
  [`e2e/todos.spec.ts`](e2e/todos.spec.ts) decides which browser requests are
  recorded/replayed.
- **Browser-only app?** If your app never fetches from the server, you don't need
  `registerProxyFetch()` or the `.mock.json` side — see the
  [Chrome extension example](../example-extension) for the HAR-only setup.
