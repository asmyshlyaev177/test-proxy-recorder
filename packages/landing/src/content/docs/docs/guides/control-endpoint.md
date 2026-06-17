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
  mode: 'transparent' | 'record' | 'replay';
  id?: string;       // required for record/replay
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
}
```

In most setups you don't call this directly — `playwrightProxy.before()` and `setProxyMode()` (see the [API reference](/docs/reference/api/readme/)) post to it for you. Reach for `/__control` when driving the proxy from a shell, a CI step, or an AI agent.
