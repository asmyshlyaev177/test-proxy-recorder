# example-init

Black-box e2e coverage for the `test-proxy-recorder init` config scaffold.

This is not a demo app you interact with — it's a minimal consumer project that
exercises the **shipped CLI** end to end:

1. Seeds a throwaway project with an existing `package.json` and
   `playwright.config.ts`.
2. Runs the built `test-proxy-recorder init`, asserting it:
   - writes `test-proxy-recorder.config.ts`,
   - edits the existing Playwright config in place (adds the proxy `webServer`,
     keeps the original settings),
   - merges the proxy scripts into `package.json` without clobbering.
3. Starts `test-proxy-recorder` with **no arguments**, so target/port/recordings
   dir all have to come from that generated config (auto-discovery).
4. Records a request through the proxy against a mock backend, then replays it
   with the backend shut down — proving the recording is served from disk.

The test imports nothing from the library source; it only spawns the CLI and
talks to it over HTTP, so it validates the real artifact a user would install.

```bash
pnpm --filter example-init test:e2e
# or from the repo root:
pnpm run init:test:e2e
```

The test builds the library first if `dist/` is missing, so it is self-contained.
