# Recording names and replay matching

## Recording names

A test's session id is its file path without the test-file extension, then its `describe` titles and its title, lowercased with spaces as hyphens, joined by `__`:

```text
jobs/Create.spec.ts › admin › create a job  →  jobs/Create__admin__create-a-job
smoke.e2e.ts › home loads                     →  smoke.e2e__home-loads
```

File names replace `/` with `__` and any character Windows forbids (`< > : " \ | ? *`) with `_`, and a name past 120 bytes is cut and ends in a hash. The `.mock.json` and `.har` of a test share one name, the same on every platform:

```text
e2e/recordings/
  jobs__Create__admin__create-a-job.mock.json   # proxy (server-side and proxied browser calls)
  jobs__Create__admin__create-a-job.har         # browser-side calls matched by `url`
```

Earlier versions ignored `describe` titles, so two tests with the same title in one file shared a recording, and only `.spec.ts` / `.test.ts` files got the file prefix. They also kept such characters in `.har` names, which broke on Windows, and cut long `.mock.json` names by characters rather than bytes. Replay still finds a recording under its old name when none exists under the new one, so existing suites keep passing. Re-recording a test writes the new name; delete its old file afterwards.

## Replay matching

The proxy (`.mock.json`):

- A request matches a recording by method, path, query and request body, so requests sent in parallel get their own responses whatever order they arrive in. `GET` and `HEAD` requests match by method, path and query alone.
- The body comparison applies the proxy's body redaction to both bodies and ignores a multipart boundary.
- A request whose body no recording has fails like a request with no recording, and the reason names the body. Keep bodies the same between runs: a current date or a random id in a body fails replay.
- Headers are ignored, so assert what the page sent with Playwright's `page.on('request')`, not through replay.
- Repeated calls with the same method, path, query and body are served in recorded order. Once they run out, the last one is reused and the proxy logs `[REPLAY WARNING]` instead of failing.

Browser-side calls matched by `url` (`.har`):

- A request matches an entry by method, URL and body, then by the most shared request headers (the same URL and body can be different operations told apart by a header). A body no entry has matches by method and URL, and a multipart boundary is ignored.
- Each entry is served once, in recorded order, not the first match every time as Playwright's own `routeFromHAR` replay does; one is reused only when the page asks more often than the recording did. Once a write (any method but `GET`, `HEAD` and `OPTIONS`) to a path is replayed, reads of that path or of a path under it prefer entries recorded after it, and a read with none left before the next such write reuses the latest one before it. A recorded redirect is followed inside the `.har`, since the browser's follow-up request never reaches `page.route()`.
- A request with no entry is aborted and `[Client-Side Replay] No recorded response for <method> <url>` is logged, so the test fails on the failed fetch rather than through the proxy's 404 below.

## A request with no recording

The proxy answers it with a 404 and reports it to the test, which fails at once: `playwrightProxy.before()` closes the page with a reason such as `[test-proxy-recorder] No recording for GET /api/todos in session home__loads`, also printed to stderr. A `locator.waitFor()` or `page.goto()` error carries the reason itself. An `expect(locator)` failure reports what it last saw (`element(s) not found`, or the last value it read), and the reason is the last line of its call log; it is also printed to stderr above the error.

The usual causes are a test whose requests changed since it was recorded or a request the app makes on a timer. Re-record the test.
