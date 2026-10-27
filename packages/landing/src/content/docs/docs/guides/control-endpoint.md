---
title: Control endpoint
description: The proxy exposes /__control for programmatic mode switching between transparent, record, and replay.
---

The proxy exposes `/__control` for programmatic mode switching.

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // required unless cleanup is true
  id?: string;       // required for record/replay (and for cleanup)
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

In most setups you don't call this directly — `playwrightProxy.before()` and `setProxyMode()` (see the [API reference](/docs/reference/api/readme/)) post to it for you. Reach for `/__control` when driving the proxy from a shell, a CI step, or an AI agent.

## Sessions

The proxy keeps one session per test id, in record mode as in replay, so tests on parallel workers share one proxy. Each request goes to the session named in its `x-test-rcrd-id` header, or in the `proxy-recording-id` cookie on a browser WebSocket handshake. Versions up to 2.0.1 kept one record session for every request.

- **`{"mode": "record", "id": "my-test-1"}`** starts recording that session. Sessions that are already recording keep going.
- **`{"id": "my-test-1", "cleanup": true}`** acts on that session only. A replay session closes. A recording session is saved to its `.mock.json` and keeps recording the requests that name it until a switch to `transparent`, so a late request from that test is saved too.
- **`{"mode": "transparent"}`** saves and ends every session, so every request passes through to the target. `playwrightProxy.teardown()` sends it. The mode timer does the same when `timeout` runs out, and every switch restarts the timer.

A request that names no session goes to the one session that is running. With several sessions running, the proxy answers it with a 400 in record and replay alike, and the body lists the running ids in `activeSessions`. With no session running, the request follows the last switch.

## Current state

`GET /__control` returns:

- `recordingsDir`, the directory recordings are written to.
- `mode` and `id`, from the last switch.
- `redaction`, the [redaction](/docs/guides/secret-redaction/) config, or `false` when redaction is off. `playwrightProxy.teardown()` reads it to redact `.har` files.
- `sessions`, the ids that are recording now.

