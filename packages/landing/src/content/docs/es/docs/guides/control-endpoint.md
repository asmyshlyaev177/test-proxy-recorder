---
title: Endpoint de control
description: El proxy expone /__control para cambiar de modo programáticamente entre transparent, record y replay.
---

El proxy expone `/__control` para cambiar de modo programáticamente.

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

En la mayoría de configuraciones no llamas a esto directamente — `playwrightProxy.before()` y `setProxyMode()` (mira la [referencia de la API](/docs/reference/api/readme/)) hacen POST por ti. Recurre a `/__control` cuando controlas el proxy desde una shell, un paso de CI o un agente de IA.
