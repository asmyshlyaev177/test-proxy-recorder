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

- A request matches a recording by method, path and query. Headers and the request body are ignored, so assert what the page sent with Playwright's `page.on('request')`, not through replay.
- Repeated calls to the same method, path and query are served in recorded order. Once they run out, the last one is reused and the proxy logs `[REPLAY WARNING]` instead of failing.

## A request with no recording

The proxy answers it with a 404 and reports it to the test, which fails at once: `playwrightProxy.before()` closes the page with a reason such as `[test-proxy-recorder] No recording for GET /api/todos in session home__loads`, also printed to stderr. A `locator.waitFor()` or `page.goto()` error carries the reason itself. An `expect(locator)` failure reports what it last saw (`element(s) not found`, or the last value it read), and the reason is the last line of its call log; it is also printed to stderr above the error.

The usual causes are a test whose requests changed since it was recorded (re-record it) or a request the app makes on a timer. To let such requests through as 404s, pass `failOnMissingRecording: false` to `playwrightProxy.before()`.
