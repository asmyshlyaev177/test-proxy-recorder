---
title: CLI
description: The test-proxy-recorder command-line interface — options, WebSocket replay pacing, and how to reset a stuck proxy.
---

```bash
test-proxy-recorder <target-url> [options]
```

| Option           | Default        | Description                         |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(required)*   | Backend URL to proxy                |
| `--port, -p`     | `8000`         | Proxy listen port                   |
| `--dir, -d`      | `./recordings` | Directory for recording files       |
| `--timeout, -t`  | `120000`       | Session auto-reset timeout (ms)     |
| `--config, -c`   | *(auto)*       | Path to a config file               |
| `--ws-timing`    | `burst`        | WebSocket replay pacing — `burst` or `original` |

Secret redaction is **on by default** — Authorization/Cookie/Set-Cookie are stripped from recordings automatically. Turn it off with `--no-redact`, or `redaction: false` in the [config](/docs/guides/config/). See [secret redaction](/docs/guides/secret-redaction/) for the `--redact-headers` and `--redact-body` flags that add to what's redacted.

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## WebSocket replay pacing

By default, recorded WebSocket server messages are replayed as a **burst** on connect — fastest and fully deterministic, ideal for CI. Pass `--ws-timing original` (or `websocket: { timing: 'original' }` in the config) to instead re-pace them using the recorded timestamps, so messages arrive with their real inter-message gaps; a test then takes roughly the recording's wall-clock span.

You can also set this **per test** via `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, which overrides the proxy-level default for that session only.

## Reset a stuck proxy

The proxy auto-reverts to `transparent` after each session times out, and the `globalTeardown` resets it at the end of a clean run. But an **interrupted** run (`Ctrl+C`), a UI/debug session, or a config without `globalTeardown` can leave the shared proxy stuck in `record`/`replay` — so your app keeps serving recorded responses instead of hitting the real backend. Reset it on demand:

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

This POSTs `{ "mode": "transparent" }` to `/__control` — the supported, parallel-safe replacement for resetting by hand with `curl`. It's safe to run anytime: an unreachable proxy is treated as a no-op. The port is resolved as **`--port` flag → `TEST_PROXY_RECORDER_PORT` env → config file → `8000`**, so it targets the port the proxy was started on (pass `--port` / `--config` to override). `init` scaffolds this as the `proxy:reset` script.

## `init` — scaffold the setup

See the [quick start](/docs/getting-started/quick-start/) for the recommended one-command setup with `npx test-proxy-recorder init`.
