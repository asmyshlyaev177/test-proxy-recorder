---
title: Endpoint de control
description: El proxy expone /__control para cambiar de modo programáticamente entre transparent, record y replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
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
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

En la mayoría de configuraciones no llamas a esto directamente — `playwrightProxy.before()` y `setProxyMode()` (mira la [referencia de la API](/docs/reference/api/readme/)) hacen POST por ti. Recurre a `/__control` cuando controlas el proxy desde una shell, un paso de CI o un agente de IA.

## Sesiones

El proxy mantiene una sesión por id de prueba, tanto en modo record como en replay, así que las pruebas en workers paralelos comparten un único proxy. Cada petición va a la sesión indicada en su cabecera `x-test-rcrd-id`, o en la cookie `proxy-recording-id` en el handshake de un WebSocket del navegador. Las versiones hasta la 2.0.1 mantenían una única sesión de grabación para todas las peticiones.

- **`{"mode": "record", "id": "my-test-1"}`** empieza a grabar esa sesión. Las sesiones que ya están grabando siguen haciéndolo.
- **`{"id": "my-test-1", "cleanup": true}`** actúa solo sobre esa sesión. Una sesión de reproducción se cierra. Una sesión de grabación se guarda en su `.mock.json` y sigue grabando las peticiones que la indican hasta un cambio a `transparent`, así que también se guarda una petición tardía de esa prueba.
- **`{"mode": "transparent"}`** guarda y termina todas las sesiones, así que todas las peticiones pasan directamente al destino. `playwrightProxy.teardown()` lo envía. El temporizador de modo hace lo mismo cuando se agota `timeout`, y cada cambio de modo reinicia el temporizador.

Una petición que no indica ninguna sesión va a la única sesión en marcha. Si hay varias sesiones en marcha, el proxy responde con un 400, tanto en record como en replay, y el cuerpo lista los ids en marcha en `activeSessions`. Si no hay ninguna sesión en marcha, la petición sigue el último cambio de modo.

## Estado actual

`GET /__control` devuelve:

- `recordingsDir`, el directorio donde se escriben las grabaciones.
- `mode` e `id`, del último cambio de modo.
- `redaction`, la configuración de [enmascaramiento](/es/docs/guides/secret-redaction/), o `false` cuando el enmascaramiento está desactivado. `playwrightProxy.teardown()` la lee para enmascarar los archivos `.har`.
- `sessions`, los ids que están grabando ahora.
