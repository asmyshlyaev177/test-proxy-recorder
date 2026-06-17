---
title: Эндпоинт управления
description: Прокси предоставляет /__control для программного переключения режимов между transparent, record и replay.
---

Прокси предоставляет `/__control` для программного переключения режимов.

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

В большинстве настроек вы не вызываете это напрямую — `playwrightProxy.before()` и `setProxyMode()` (см. [справочник API](/docs/reference/api/readme/)) отправляют POST за вас. Обращайтесь к `/__control`, когда управляете прокси из shell, шага CI или ИИ-агента.
