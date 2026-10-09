---
title: 'Mock server-side requests in Playwright (Next.js, TanStack Start)'
description: 'Why page.route() misses server-side fetches in Next.js and TanStack Start, and how test mode, MSW, mockttp or recorded responses handle them in Playwright.'
sidebar:
  label: Server-side mocking
---

In a Next.js or TanStack Start app, the server calls your API while it renders a page. Playwright's request mocking never sees those calls. The sections below explain why, then compare four ways to control them in a Playwright test: Next.js test mode, MSW inside the server, a forward proxy such as mockttp, and recording real responses with test-proxy-recorder. Facts about the other tools were checked against their own docs and source on 2026-10-03.

## Why `page.route()` can't see server-side requests {#why}

Playwright's [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) works on "network requests that are made by a page". A Server Component, a route loader or a server function runs in your app's Node.js process instead. Its `fetch` goes from that process straight to the API. The request never passes through the browser, so Playwright has nothing to intercept. `page.route()` does see the page request the browser sends to your app, and the HTML that comes back. It never sees the requests the server made to build that HTML.

HAR files have the same limit, because [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) serves "the network requests that are made in the page".

MSW's [comparison with Playwright](https://mswjs.io/docs/comparison#playwright) says the same: `page.route()` affects "the traffic in the spawned browser, not the Node.js process". The Playwright team's [post on server-side mocking](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) says `page.route()` works for browser requests, and "For server-side HTTP calls, it doesn't." The feature request for built-in server-side mocking, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), was closed on 2026-05-22 with a link to that post.

## Next.js test mode {#nextjs-test-mode}

Next.js ships an experimental Playwright integration at `next/experimental/testmode/playwright`. Its only documentation is a [README in the Next.js repository](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), and the [Next.js Playwright guide](https://nextjs.org/docs/app/guides/testing/playwright) does not mention it. A test registers handlers with `next.onFetch()`, and Next.js sends the server's `fetch` calls to them:

```typescript
// Shortened from the README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

What it needs:

- `experimental: { testProxy: true }` in `next.config.js`.
- A `playwright.config.ts` built with `defineConfig` from `next/experimental/testmode/playwright`, and tests that import `test` from the same module.

Under the hood, each Playwright worker starts a small proxy server. The fixture adds a `Next-Test-Proxy-Port` header (that proxy) and a `Next-Test-Data` header (the test id) to the page's requests ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). With `testProxy` on, the server reads those headers and sends each server-side `fetch` to that proxy. The proxy hands the request to that test's handlers ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Handlers are kept per test id, so parallel tests can share one Next.js server. A server fetch that no handler answers throws `Proxy request aborted`. A handler can return `'continue'` to let a request through instead. `next.onFetch()` also receives the page's own `fetch` calls to other origins.

Status:

- Experimental. The import path and the config key both say so, and the README is titled "Experimental test mode for Playwright".
- It still gets fixes. The latest, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), was merged on 2026-08-13.
- The README also offers MSW handlers per test through `next/experimental/testmode/playwright/msw`. With MSW 3.0 (released 2026-09-28) that entry point fails to load. It imports `strict-event-emitter`, which MSW 3.0 no longer depends on. It also calls MSW's `handleRequest()`, which 3.0 removed ([MSW 3.0 release notes](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). It loads with MSW 2.15.0. Both results are from Next.js 16.3.8, checked on 2026-10-03.

## MSW in the Next.js server {#msw}

MSW intercepts requests in Node.js with `setupServer` from `msw/node` ([Node.js integration](https://mswjs.io/guides/integrations/node)). Its docs have no Next.js guide. When MSW's author closed the App Router issue, he named [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) as the integration reference ([comment](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). That pull request has been open since 2024-01-22. It starts the interceptor from the root layout, with a fixed list of handlers:

```tsx
// app/layout.tsx, from mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

The handlers then live in the Next.js process. The example starts that process with Playwright's `webServer`, which runs one process for the whole run ([Playwright team's post](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Every worker sends its pages to that one server, and parallel workers change how its handlers behave:

- A test can't call `server.use()` on that server, because the test runs in its own worker process. MSW has no released API for changing handlers in another process. The proposal, `setupRemoteServer` in [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617), has been open since 2023-05-12. MSW's Playwright binding says it relies on `page.route()` until that ships ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- If you add your own channel, such as an API route calling `server.use()`, the change reaches every test. Handlers added with [`server.use()`](https://mswjs.io/api/setup-server/use) "persist on the server instance". The [server boundary post](https://mswjs.io/blog/introducing-server-boundary) explains that concurrent overrides on one server become "a global state shared between all tests". In #1617, MSW's author notes that in practice you either keep "a fixed list of handlers" or start "an app instance per test case".

In practice, MSW inside a shared Next.js server gives every parallel test the same responses. Two tools add per-test handlers on top of MSW. Next.js test mode accepts MSW handlers (with MSW 2, see above). [scenarist](https://github.com/citypaul/scenarist) keys scenarios by an `x-scenarist-test-id` header that your server code forwards on each `fetch` ([Next.js adapter](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## A forward proxy such as mockttp {#mockttp}

When the Playwright team closed #30766, they [pointed to](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) Simon Knott's [post](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo). It puts [mockttp](https://github.com/httptoolkit/mockttp), an HTTP and HTTPS mock server and proxy, in front of the server's outgoing traffic. Each test adds rules to it, such as `mocks.forPost(url).thenJson(200, body)`.

The app's code doesn't change. Its server process starts with environment variables that send outgoing requests through the proxy:

- `HTTP_PROXY` and `HTTPS_PROXY` set to the proxy's URL.
- `NODE_USE_ENV_PROXY=1`, so Node's built-in `fetch` uses those variables. Node.js added it in 24.0.0 and 22.21.0, and marks it as active development ([Node.js docs](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS` pointing at the proxy's CA certificate, so the server trusts the certificates mockttp generates for HTTPS hosts.

The proxy belongs to one Playwright worker, so the post starts one app server per worker from a worker fixture, each on a free port. It avoids Playwright's `webServer`, which starts one process for the whole run before any worker exists. In the post's setup, requests with no rule pass through to the real API. The post suggests answering them with an error instead, so a forgotten mock shows up.

The Playwright team describes the approach as "agnostic of the server language and framework". The post itself uses a plain Node server, not Next.js or TanStack Start.

## Record real responses with test-proxy-recorder {#test-proxy-recorder}

With the three options above, you write every response yourself. test-proxy-recorder records what your real API returns during a local run, then replays it on CI.

- **The proxy.** Start `test-proxy-recorder <target-url>` next to your app for the test run. Point the app's API base URL at it while `TEST_PROXY_RECORDER_ENABLED` is set. Each proxy forwards to one backend, the `<target-url>` it was started with.
- **`registerProxyFetch()`.** One call on the server patches the global `fetch`. It copies the current request's `x-test-rcrd-id` header onto every outgoing request. The proxy reads that header to file each server-side call under its test. The call is a no-op in production unless `TEST_PROXY_RECORDER_ENABLED` is set.
- **The per-test id.** `playwrightProxy.before(page, testInfo, mode)` builds a session id from the spec file, its `describe` titles and the test title. It sends that id as `x-test-rcrd-id` on the page's requests and switches that session to `record` or `replay`. Parallel workers share one app server and one proxy, and each test still gets its own recording.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Record once against the real API and commit the `.mock.json` (server) and `.har` (browser) files. CI then replays them with the backend off. In replay, a request with no recording gets a 404 that names it. It never reaches the API.

Recorded responses only cover what the API did while you recorded. To force an error or an edge case the API won't produce on demand, a hand-written handler from one of the options above is simpler.

Setup details are in the [Next.js](/docs/integrations/nextjs/) and [TanStack Start](/docs/integrations/tanstack-start/) guides.

## Compare the options {#comparison}

| Option | Setup in the app | Parallel tests | Handlers or recorded responses | Next.js and TanStack Start |
| --- | --- | --- | --- | --- |
| [Next.js test mode](#nextjs-test-mode) | `experimental.testProxy` in `next.config.js` | Yes, handlers are kept per test | Handlers (`next.onFetch()`, or MSW 2 handlers) | Next.js only |
| [MSW in the server](#msw) | `setupServer` started in server code (the root layout in MSW's example) | One handler set for every test on that server | Handlers | Next.js: an example in an open pull request. TanStack Start: not documented |
| [mockttp](#mockttp) | No code change. Proxy variables and a CA certificate on the server process | Yes, with one app server per worker | Handlers. Requests with no rule pass through | Not documented. The Playwright team calls it framework-agnostic |
| [test-proxy-recorder](#test-proxy-recorder) | API base URL pointed at the proxy during tests, plus `registerProxyFetch()` | Yes, with one shared app server | Recorded from the real API | Both documented |

The [comparison](/docs/reference/comparison/) covers more tools, including Mocky Balboa, scenarist, Polly.js, talkback and proxay, and the browser-side options.
