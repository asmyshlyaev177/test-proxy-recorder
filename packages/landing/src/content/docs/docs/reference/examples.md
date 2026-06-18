---
title: Example apps
description: Full working examples of test-proxy-recorder — Next.js SSR, a Chrome extension, a third-party WebSocket ticker, and an authenticated app replayed with no backend.
---

Full working examples live in [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — one per recording mechanism. Each has its own README with the full setup and record/replay workflow.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — a Next.js 16 todo app with a mock backend, proxy, and Playwright e2e tests. Records both SSR fetches (`.mock.json`) and browser fetches (`.har`), and includes a WebSocket chat against the local backend. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

## Next.js Edge runtime {#nextjs-edge}

[`apps/example-nextjs-edge`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — a Next.js 16 app whose page renders on the **Edge runtime** (`export const runtime = 'edge'`). Its SSR `fetch` is tagged with the recording-session id via `registerProxyFetch()` (called from the root layout), so concurrent replay sessions stay distinct where `instrumentation.ts` can't reach. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs-edge/README.md).

## Chrome extension {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — a real Chrome extension that calls X/Twitter's API from a content script; browser requests are recorded to `.har` and replayed offline, with no live API or account needed on CI. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

## Crypto ticker — third-party WebSocket {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — a live BTC-USD price ticker backed by Binance's public WebSocket feed. Records the real feed once through the proxy, then replays deterministic prices on CI with no network or exchange account. See its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

## Authenticated app {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — a Next.js app that logs into a **real AWS Cognito** user pool, then records/replays its protected API. Login stays live every run (never recorded); the protected data replays with the backend turned off, and the auth token is redacted from the recordings. The integration is just a handful of files — see its [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md). For the same pattern with **no cloud account**, see [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
