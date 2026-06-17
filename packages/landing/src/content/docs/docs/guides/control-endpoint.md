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
  cleanup?: boolean; // when true, clean up the session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

In most setups you don't call this directly — `playwrightProxy.before()` and `setProxyMode()` (see the [API reference](/docs/reference/api/readme/)) post to it for you. Reach for `/__control` when driving the proxy from a shell, a CI step, or an AI agent.
