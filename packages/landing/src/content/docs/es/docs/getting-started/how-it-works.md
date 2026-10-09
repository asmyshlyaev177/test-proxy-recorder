---
title: 'Cómo funciona grabar y reproducir: un proxy para SSR y HAR para el navegador'
description: test-proxy-recorder graba tráfico mediante dos mecanismos, un proxy para las peticiones del lado del servidor y HAR para las del lado del navegador, que se usan juntos o por separado.
sidebar:
  label: Cómo funciona
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 32bdd456b9abbf2556d3314806353dd2cc86c971
---

test-proxy-recorder admite dos mecanismos de grabación según dónde se originan tus peticiones. Ambos pueden usarse juntos o de forma independiente.

| Mecanismo | Qué graba | Caso de uso |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Peticiones del lado del servidor (fetches SSR de Next.js, etc.) | Apps full-stack donde el servidor llama a la API |
| **HAR** (`.har`) | Peticiones del lado del navegador (`fetch` del navegador, extensiones, SPAs) | SPAs, extensiones de Chrome, APIs de terceros |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Cada prueba establece el modo al empezar, y el proxy mantiene un único modo para todas las peticiones que recibe, así que las pruebas que se ejecutan a la vez lo comparten. En modo **record** el proxy reenvía al backend real y guarda las respuestas; en modo **replay** sirve las respuestas guardadas desde disco, y el id de cada prueba elige la grabación de esa prueba; en modo **transparent** reenvía sin grabar. El proxy arranca en modo transparent, así que una app que pasa por él fuera de las pruebas habla con su backend como siempre. Mira el [endpoint de control](/es/docs/guides/control-endpoint/) para saber cómo se cambian los modos.

## Cómo se emparejan las peticiones al reproducir {#replay-matching}

El proxy y el archivo HAR buscan una respuesta grabada de formas distintas.

| Al reproducir | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Se empareja por | Método, ruta y un hash MD5 de la cadena de consulta (query string). El cuerpo no se compara. | Método y URL, más el cuerpo en un `POST` ([reglas de Playwright](https://playwright.dev/docs/mock#replaying-from-har)). |
| La misma petición otra vez | La siguiente grabación, en el orden grabado. | La entrada con más cabeceras coincidentes. El orden grabado se ignora. |
| Sin grabación | Un 404 con un cuerpo JSON que indica la petición, y `playwrightProxy.before()` cierra la página para que la prueba falle de inmediato (`failOnMissingRecording: false` lo desactiva). | La petición se aborta. |
| Llega a la API real | Solo en modo `transparent`. | Solo las peticiones que no coinciden con `url`. |

### Peticiones del lado del servidor (proxy)

La clave es el método, la ruta y los primeros 16 caracteres hexadecimales del hash MD5 de la cadena de consulta. `GET /todos?page=2` tiene la clave `GET_todos_46589c7afd19c014.json`, así que una cadena de consulta que difiera en lo más mínimo, incluso en el orden de los parámetros, produce una clave distinta.

Las llamadas con la misma clave se sirven en el orden en que se grabaron. Una llamada posterior a la última grabación recibe de nuevo la última respuesta, y el proxy registra `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`.

Una petición sin grabación no llega a la API real. El proxy registra líneas `[REPLAY ERROR]` y responde con un 404:

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

El proxy envía peticiones al backend real solo en modo `transparent`. Una ejecución de reproducción acaba ahí de dos formas: `playwrightProxy.teardown()` se ejecuta mientras aún hay pruebas en marcha, o el timeout de sesión (120000 ms por defecto) se agota antes de la siguiente llamada a `playwrightProxy.before()`. Las [preguntas frecuentes](/es/docs/reference/faq/#parallel-replay) explican ambos casos.

### Peticiones del navegador (HAR)

Cuando pasas `url`, `playwrightProxy.before()` entrega las peticiones del navegador al enrutamiento HAR de Playwright:

```typescript
await page.routeFromHAR(harPath, { url, update: mode === 'record', updateContent: 'embed' });
```

La opción `notFound` de Playwright vale `'abort'` por defecto, así que, al reproducir, una petición que coincide con `url` pero no está en el `.har` se aborta. Las peticiones que no coinciden con `url` no se interceptan. Van a la red real, tanto al grabar como al reproducir.

Las peticiones al propio proxy (`localhost:8100`) son la excepción. `before()` registra su propio handler para ellas después del de HAR, y Playwright ejecuta primero el handler registrado más tarde. Ese handler las reenvía al proxy, que las reproduce desde `.mock.json` igual que las peticiones del lado del servidor.
