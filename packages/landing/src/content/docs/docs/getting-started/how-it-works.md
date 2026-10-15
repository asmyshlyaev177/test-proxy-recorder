---
title: 'How record and replay works: a proxy for SSR, HAR for the browser'
description: test-proxy-recorder records traffic through two mechanisms, a proxy for server-side requests and HAR for browser-side requests, used together or on their own.
sidebar:
  label: How it works
---

test-proxy-recorder supports two recording mechanisms depending on where your requests originate. Both can be used together or independently.

| Mechanism | What it records | Use case |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Server-side requests (SSR fetches from Next.js etc.) | Full-stack apps where the server calls the API |
| **HAR** (`.har`) | Browser-side requests (browser `fetch`, extensions, SPAs) | SPAs, Chrome extensions, 3rd-party APIs |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Each test sets the mode when it starts, and the proxy keeps one mode for every request it gets, so tests that run at the same time share it. In **record** mode the proxy forwards to the real backend and saves responses; in **replay** mode it serves the saved responses from disk, and each test's id picks that test's recording; in **transparent** mode it forwards without recording. The proxy starts in transparent mode, so an app run through it outside tests talks to its backend as usual. See the [control endpoint](/docs/guides/control-endpoint/) for how modes are switched.

## How replay matches requests {#replay-matching}

The proxy and the HAR file look up a recorded response in different ways.

| In replay | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Matched on | Method, path and an MD5 hash of the query string. The body is not compared. | Method, URL and body, then the entries sharing the most request headers, since the same URL and body can be different operations told apart by a header. A body no entry has falls back to method and URL, and a multipart boundary is ignored. |
| Same request again | The next recording, in recorded order. | The next recording, in recorded order, with one rule for writes (below). |
| No recording | A 404 with a JSON body that names the request, and `playwrightProxy.before()` closes the page so the test fails at once (`failOnMissingRecording: false` turns that off). | The request is aborted and `[Client-Side Replay] No recorded response for <method> <url>` is logged. |
| Real API reached | Only in `transparent` mode. | Only by requests that don't match `url`. |

### Server-side requests (proxy)

The key is the method, the path and the first 16 hex characters of the query string's MD5 hash. `GET /todos?page=2` has the key `GET_todos_46589c7afd19c014.json`, so a query string that differs at all, even in parameter order, makes a different key.

Calls with the same key are served in the order they were recorded. A call past the last recording gets the last response again, and the proxy logs `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`.

A request with no recording doesn't reach the real API. The proxy logs `[REPLAY ERROR]` lines and answers with a 404:

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

The proxy sends requests to the real backend only in `transparent` mode. A replay run ends up there in two ways: `playwrightProxy.teardown()` runs while tests are still going, or the session timeout (120000 ms by default) runs out before the next `playwrightProxy.before()` call. The [FAQ](/docs/reference/faq/#parallel-replay) explains both.

### Browser requests (HAR)

When you pass `url`, `playwrightProxy.before()` records matching browser requests with Playwright's HAR recorder:

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

Replay is the library's own `page.route()` handler over that file, not `page.routeFromHAR()`. Playwright's replay serves every repeat of a request the first matching entry ([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), so a `GET` after a `POST` showed the list from before the `POST`. The handler serves each recording once, in recorded order, and reuses one only when the page asks more often than the recording did. One rule orders reads around writes. Once a write (any method but `GET`, `HEAD` and `OPTIONS`, so a GraphQL query counts) to a path has been replayed, a read of that path or of a path under it prefers the copies recorded after the write. A read with no copy left before the next such write reuses the latest one before it. The rule keeps replay right when the app reads a different number of times than it did while recording, such as a double fetch under React strict mode. A recorded redirect is followed inside the `.har`, because the browser's follow-up request never reaches `page.route()`: a fetch gets the final response, and a navigation is sent on to the redirect's target.

A request that matches `url` but isn't in the `.har` is aborted. Requests that don't match `url` aren't intercepted, and in `transparent` mode none are. They go to the real network.

Requests to the proxy itself (`localhost:8100`) are the exception. `before()` registers its own handler for them after the HAR one, and Playwright runs the later handler first. The handler sends them on to the proxy, which replays them from `.mock.json` like server-side requests.
