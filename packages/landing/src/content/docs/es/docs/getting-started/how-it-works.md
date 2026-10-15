---
title: 'Cómo funciona grabar y reproducir: un proxy para SSR y HAR para el navegador'
description: test-proxy-recorder graba tráfico mediante dos mecanismos, un proxy para las peticiones del lado del servidor y HAR para las del lado del navegador, que se usan juntos o por separado.
sidebar:
  label: Cómo funciona
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 26b907ff9c82df698a55827441e0b4b432a42262
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
| Se empareja por | Método, ruta y un hash MD5 de la cadena de consulta (query string). El cuerpo no se compara. | Método, URL y cuerpo, y luego las entradas que comparten más cabeceras de la petición, ya que la misma URL y el mismo cuerpo pueden ser operaciones distintas que se diferencian por una cabecera. Si ninguna entrada tiene ese cuerpo, se empareja solo por método y URL, y el delimitador (boundary) de multipart se ignora. |
| La misma petición otra vez | La siguiente grabación, en el orden grabado. | La siguiente grabación, en el orden grabado, con una regla para las escrituras (ver más abajo). |
| Sin grabación | Un 404 con un cuerpo JSON que indica la petición, y `playwrightProxy.before()` cierra la página para que la prueba falle de inmediato (`failOnMissingRecording: false` lo desactiva). | La petición se aborta y se registra `[Client-Side Replay] No recorded response for <method> <url>` en el log. |
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

Cuando pasas `url`, `playwrightProxy.before()` graba con el grabador HAR de Playwright las peticiones del navegador que coinciden:

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

La reproducción la hace un handler `page.route()` propio de la librería sobre ese archivo, no `page.routeFromHAR()`. La reproducción de Playwright responde a cada repetición de una petición con la primera entrada que coincide ([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), así que un `GET` después de un `POST` mostraba la lista de antes del `POST`. El handler, en cambio, sirve cada grabación una sola vez, en el orden grabado, y solo reutiliza una cuando la página pide más veces que en la grabación. Una regla ordena las lecturas respecto a las escrituras. Una vez reproducida una escritura en una ruta (cualquier método salvo `GET`, `HEAD` y `OPTIONS`, así que una query de GraphQL cuenta), una lectura de esa ruta o de una ruta por debajo de ella prefiere las copias grabadas después de la escritura. Una lectura a la que no le quedan copias antes de la siguiente escritura de ese tipo reutiliza la más reciente anterior a esa escritura. La regla mantiene correcta la reproducción cuando la app lee un número de veces distinto al de la grabación, como un doble fetch en el modo estricto de React. Una redirección grabada se sigue dentro del `.har`, porque la petición posterior del navegador nunca llega a `page.route()`: un fetch recibe la respuesta final y una navegación se envía al destino de la redirección.

Una petición que coincide con `url` pero no está en el `.har` se aborta. Las peticiones que no coinciden con `url` no se interceptan, y en el modo `transparent` no se intercepta ninguna. Van a la red real.

Las peticiones al propio proxy (`localhost:8100`) son la excepción. `before()` registra su propio handler para ellas después del de HAR, y Playwright ejecuta primero el handler registrado más tarde. Ese handler las reenvía al proxy, que las reproduce desde `.mock.json` igual que las peticiones del lado del servidor.
