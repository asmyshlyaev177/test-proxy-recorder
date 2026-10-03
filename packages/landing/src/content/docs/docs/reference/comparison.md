---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js and Next.js test mode'
description: 'How test-proxy-recorder compares with MSW, routeFromHAR, Polly.js, Next.js test mode, mockttp, Mocky Balboa, scenarist, talkback and proxay, with sources.'
sidebar:
  label: Comparison
---

Each tool here controls the API responses an end-to-end test sees. They differ in where they intercept requests (in the browser, inside your server, or in a separate proxy) and in whether you write the responses or record them. The table keeps the six tools from the [docs overview](/docs/#comparison) and adds Next.js test mode, mockttp, scenarist, talkback and proxay. Every cell comes from the tool's own docs, README or source, linked below the table, as of 2026-10-03. "Not documented" means those sources don't say.

## Feature table {#table}

| Tool | Record real traffic | Server-side (SSR) | Browser-side | WebSocket | Playwright-native | Latest release |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Yes | Yes, through the proxy | Yes, through HAR | Yes | Yes | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Yes | No | Yes | No | Built in | Playwright 1.63.0, 2026-09-04 |
| MSW | No (handlers, or a HAR through `@msw/source`) | Inside the server process | Yes | Yes | `@msw/playwright`, browser requests | 3.0.2, 2026-10-03 |
| Polly.js | Yes | Inside the server process | Yes | Not documented | Third-party adapter | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Yes | No | Yes | Not documented | Yes | 0.3.0, 2026-05-12 |
| Mocky Balboa | No (handlers) | Yes | Yes | Not documented | Yes | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Next.js test mode | No (handlers) | Yes, Next.js only | Requests to other origins | Not documented | Yes | Experimental, in Next.js 16.3.8, 2026-09-30 |
| mockttp | Not documented | Yes, as a forward proxy | Yes, as the browser's proxy | Yes | No, a fixture you write | 4.6.3, 2026-09-11 |
| scenarist | No (scenarios in code) | Next.js and Express | No | Not documented | Yes | 0.5.1, 2026-09-27 |
| talkback | Yes | Yes, as the API's address | Not documented | Not documented | No | 4.2.0, 2024-07-10 |
| proxay | Yes | Yes, as the API's address | Yes, as the API's address | Not documented | No | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## Sources and notes {#sources}

Release dates come from the npm registry unless a GitHub release is linked.

- **test-proxy-recorder.** Server-side calls go through the proxy and browser calls through HAR ([how it works](/docs/getting-started/how-it-works/)). Recorded WebSocket messages are replayed by the proxy ([CLI](/docs/guides/cli/#websocket-replay-pacing)). Release: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** With `update: true` it records a HAR from real traffic ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). Replay serves "the network requests that are made in the page" ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). It goes through `route()` handlers that fulfil HTTP requests and has no WebSocket path ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Release: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** You write request handlers. MSW records nothing itself, but [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) can generate handlers from a HAR file you export from the browser's DevTools. In Node.js it runs inside the process that makes the requests ([`setupServer`](https://mswjs.io/guides/integrations/node)). WebSockets use the [`ws` API](https://mswjs.io/docs/websocket). The official [`@msw/playwright`](https://github.com/mswjs/playwright) binding routes through `page.route()`, so it covers browser requests. Release: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** Its [repository](https://github.com/Netflix/pollyjs) describes it as "Record, Replay, and Stub HTTP Interactions". The [node-http adapter](https://netflix.github.io/pollyjs/#/adapters/node-http) patches Node's `http` and `https` modules, and the [fetch adapter](https://netflix.github.io/pollyjs/#/adapters/fetch) wraps the global `fetch`. Polly therefore records inside the process that runs it. Its docs list no WebSocket adapter. Playwright support is the third-party [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), which [Polly's docs](https://netflix.github.io/pollyjs/#/adapters/playwright) link to. Release: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** Its [README](https://github.com/vitalets/playwright-network-cache) says it speeds up Playwright tests "by caching network requests on the filesystem". `CacheRoute` intercepts with `page.route()` ([source](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), so it sees browser requests only. Release: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** You define mocks in the test, for server and client requests through one API. Mocks stay isolated per test while tests run in parallel ([features](https://docs.mockybalboa.com/docs/features/)). For Next.js 14 and later, its CLI starts your Next.js server ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). Its docs mention WebSocket only as the channel between your server and the test runner. Release: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Next.js test mode.** Handlers registered with `next.onFetch()` receive the server's `fetch` calls, plus the page's `fetch` calls to other origins ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). [Server-side mocking](/docs/guides/server-side-mocking/#nextjs-test-mode) covers its setup, its status and MSW 3. Release: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** An HTTP and HTTPS mock server and proxy for tests that run "in node or browsers" ([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()` mocks WebSocket connections ([source](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). The README describes no record mode. The Playwright team's [post](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) shows the fixture to write. Release: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** The [README](https://github.com/citypaul/scenarist) says it is "Built on MSW with runtime scenario management and test ID isolation", and you write the scenarios in code. Its FAQ says it "provides server-side scenario management, which complements Playwright's client-side mocking". Your server code forwards `x-scenarist-test-id` on each `fetch` ([Next.js adapter](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), and `@scenarist/playwright-helpers` provides the Playwright fixture. Release: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** "A javascript HTTP proxy that records and playbacks HTTP requests" ([README](https://github.com/ijpiantanida/talkback)). Your app sends its requests to talkback. A request that matches a saved tape gets the tape's response, and an unknown one is forwarded to the host and saved as a new tape. The README mentions neither browsers nor per-test tapes. Release: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** A record and replay proxy for "a web frontend and its backend" or "a server and another server" ([README](https://github.com/airtasker/proxay)). Tests pick a tape with `POST /__proxay/tape`, for example in `beforeEach`, and the README does not cover parallel tests. Version 2.0.0 is a [GitHub release](https://github.com/airtasker/proxay/releases/tag/v2.0.0); [npm](https://www.npmjs.com/package/proxay) still serves 1.9.0.

## Polly.js alternative for Playwright {#pollyjs}

Polly.js, from Netflix, records, replays and stubs HTTP, and it inspired test-proxy-recorder. Its state on 2026-10-03:

- `@pollyjs/core` has had no release since 6.0.6 on 2023-07-20. The repository's last change, on 2025-05-31, published `@pollyjs/adapter-fetch` 6.0.7, which lifted the fetch adapter's deprecation for Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Polly has no Playwright adapter of its own. Its docs point to the third-party [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), which attaches to a browser context or page. Its last release, 2.4.0, was on 2024-04-18.
- For server-side calls, Polly has to run inside the server process, through its node-http or fetch adapter.

If you're moving from Polly.js, its concepts map to test-proxy-recorder as follows.

| Polly.js | test-proxy-recorder |
| --- | --- |
| Modes `record`, `replay` and `passthrough` ([configuration](https://netflix.github.io/pollyjs/#/configuration)) | Modes `record`, `replay` and `transparent`, set per test by `playwrightProxy.before()` |
| A named recording per Polly instance, saved by a persister | A `.mock.json` (server) and a `.har` (browser) per Playwright test, in the recordings directory |
| Adapters inside the process that makes the requests | A proxy process for server calls, HAR for browser calls, and `registerProxyFetch()` on the server |
| Requests matched by method, headers, body, order and URL by default | Server-side requests matched by method, path and a hash of the query, in recorded order, with bodies not compared. Browser requests follow Playwright's HAR rules, which also compare POST bodies |

## MSW with Next.js and Playwright {#msw}

In a Next.js app, browser requests and server requests need different MSW setups.

- **Browser requests.** [`@msw/playwright`](https://github.com/mswjs/playwright), the official binding, runs your handlers through `page.route()`, with a `network` fixture you can change per test.
- **Server requests.** MSW runs inside the Next.js process. MSW's docs have no Next.js guide, and the reference example is an open pull request, [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Handlers you change at runtime are shared by every test that reaches that server. [Server-side mocking](/docs/guides/server-side-mocking/#msw) has the details and sources.
- **Per-test server handlers.** Next.js test mode takes MSW handlers per test, but its MSW entry point fails to load with MSW 3.0 ([details](/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist builds per-test scenarios on MSW for Next.js and Express, and your server code forwards a test id header on each `fetch`.
- **Recording.** MSW does not record traffic. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) turns a HAR file, exported from the browser's DevTools, into handlers.

test-proxy-recorder makes the opposite trade. It records both sides from the real API, so there are no handlers to write. In return, you have less control over responses the API won't produce on demand.

## When to use something else {#when-to-use-something-else}

- **All your traffic is browser-side.** Playwright's built-in `routeFromHAR` needs no extra dependency. Start there, and add test-proxy-recorder when server-side requests show up.
- **You want to write responses by hand, or force errors and edge cases.** MSW's handlers fit that better, and MSW also runs in [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook) and [the browser](https://mswjs.io/guides/integrations/browser), not only in Playwright. For per-test server-side handlers in Playwright, look at Mocky Balboa, scenarist or Next.js test mode.
- **You only need browser-side caching with little setup.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) caches responses on disk through one fixture.
- **Your server isn't written in JavaScript, or you can't change its code.** A forward proxy such as mockttp works through `HTTPS_PROXY`. The Playwright team's [post](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) says Python, Go, Ruby, Rust and .NET work the same way, and Java needs `-Dhttps.proxyHost` and `-Dhttps.proxyPort`.
- **You need record and replay outside Playwright, in any language.** proxay and talkback are standalone HTTP servers that save recordings as tape files.
