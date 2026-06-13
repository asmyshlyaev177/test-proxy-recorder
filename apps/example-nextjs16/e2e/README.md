# Test layout

Tests for the config-file / CLI behaviour are split into three layers, fastest
and most isolated first. Each layer answers a different question, so a failure
points at a specific seam instead of "something in the proxy broke".

| Layer | Location | Browser? | Backend? | Answers |
|---|---|---|---|---|
| 1. Unit | `packages/test-proxy-recorder/src/cli.test.ts`, `config-loader.test.ts` | no | no | Does option **resolution** work — discovery, parsing, and CLI > config > default precedence? |
| 2. CLI integration | `e2e/config-cli.spec.ts` | no | yes (`:3002`) | Does a **real spawned proxy** honour the resolved options? Exhaustive matrix of every config field + CLI override, each asserted against the saved `.mock.json`. Black box: spawns the CLI binary, drives it over HTTP. |
| 3. Full e2e | `e2e/config-e2e.spec.ts` (config-specific) + `todos.spec.ts`, `websocket.spec.ts`, `redaction.spec.ts` | yes | yes | Does it all work **through the running Next.js app**? |

## Why the layers are shaped this way

The built app bakes the proxy URL (`NEXT_PUBLIC_API_URL=http://localhost:8100`)
for browser-side calls, so the full-app stack can't cheaply vary the proxy
*port* per test. Layer 2 spawns its own throwaway proxies on free ports and
talks to them directly, which is where the broad "every config/CLI value"
matrix lives — fast and with no browser flake. It imports nothing from the
package: it spawns the CLI binary and drives it over the `/__control` HTTP API.

Layer 3 proves the config file drives the **real** stack, end to end, with no
package imports:

- The canonical browser suite (`todos` / `websocket` / `redaction`) runs against
  the `pnpm proxy` process, which is started with **no flags** and configured
  entirely by [`../test-proxy-recorder.config.ts`](../test-proxy-recorder.config.ts).
  Those passing proves `target` / `port` / `recordingsDir` resolved from the file
  (otherwise the proxy wouldn't come up on `:8100` and the suite would fail at
  `wait-on`).
- `config-e2e.spec.ts` stands up a **fully isolated** stack on free ports — its
  own mock backend, a CLI-started config-driven proxy, and a dedicated
  `next start` — then asserts **every config option** is applied:
  - `target` / `port` / `recordingsDir`: a real browser drives the app; its SSR
    fetch flows through the config proxy, is recorded into the config's dir, then
    replayed back to the app with the backend emptied.
  - `redaction.*` (`headers`, `allowHeaders`, `allowCookies`, `bodyPatterns`,
    `placeholder`, `enabled`): the app emits no secrets, so these proxy-layer
    options are exercised by sending a request through the *same* running config
    proxy and inspecting the saved recording.
  - `timeout`: the proxy auto-resets its mode after the configured ms.

  Isolation keeps it off the shared `:8100` proxy, so it runs serially without
  disturbing the parallel suite.

## Running

```bash
pnpm test:e2e          # builds, starts mock+proxy+app, runs all layers (replay)
pnpm test:e2e:record   # record mode, single worker, headed UI
```

Layer 1 runs with the package's unit tests: `pnpm --filter test-proxy-recorder test:run`.
