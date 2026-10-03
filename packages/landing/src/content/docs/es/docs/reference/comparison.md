---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js y el modo de prueba de Next.js'
description: 'Cómo se compara test-proxy-recorder con MSW, routeFromHAR, Polly.js, el modo de prueba de Next.js, mockttp, Mocky Balboa, scenarist, talkback y proxay, con fuentes.'
sidebar:
  label: Comparación
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

Cada herramienta de esta página controla las respuestas de la API que ve una prueba end-to-end. Se diferencian en dónde interceptan las peticiones (en el navegador, dentro de tu servidor o en un proxy aparte) y en si las respuestas las escribes tú o las grabas. La tabla mantiene las seis herramientas de la [introducción de la documentación](/es/docs/#comparison) y añade el modo de prueba de Next.js (Next.js test mode), mockttp, scenarist, talkback y proxay. Cada celda procede de la propia documentación, README o código fuente de la herramienta, enlazados debajo de la tabla, a fecha de 2026-10-03. «No documentado» significa que esas fuentes no lo indican.

## Tabla de características {#table}

| Herramienta | Graba tráfico real | Lado del servidor (SSR) | Lado del navegador | WebSocket | Nativo de Playwright | Última versión |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Sí | Sí, a través del proxy | Sí, a través de HAR | Sí | Sí | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Sí | No | Sí | No | Integrado | Playwright 1.63.0, 2026-09-04 |
| MSW | No (handlers, o un HAR mediante `@msw/source`) | Dentro del proceso del servidor | Sí | Sí | `@msw/playwright`, peticiones del navegador | 3.0.2, 2026-10-03 |
| Polly.js | Sí | Dentro del proceso del servidor | Sí | No documentado | Adaptador de terceros | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Sí | No | Sí | No documentado | Sí | 0.3.0, 2026-05-12 |
| Mocky Balboa | No (handlers) | Sí | Sí | No documentado | Sí | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Modo de prueba de Next.js | No (handlers) | Sí, solo Next.js | Peticiones a otros orígenes | No documentado | Sí | Experimental, en Next.js 16.3.8, 2026-09-30 |
| mockttp | No documentado | Sí, como proxy de reenvío (forward proxy) | Sí, como proxy del navegador | Sí | No, un fixture que escribes tú | 4.6.3, 2026-09-11 |
| scenarist | No (escenarios en código) | Next.js y Express | No | No documentado | Sí | 0.5.1, 2026-09-27 |
| talkback | Sí | Sí, como dirección de la API | No documentado | No documentado | No | 4.2.0, 2024-07-10 |
| proxay | Sí | Sí, como dirección de la API | Sí, como dirección de la API | No documentado | No | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## Fuentes y notas {#sources}

Las fechas de las versiones proceden del registro de npm, salvo que se enlace una release de GitHub.

- **test-proxy-recorder.** Las llamadas del lado del servidor pasan por el proxy y las del navegador por HAR ([cómo funciona](/es/docs/getting-started/how-it-works/)). El proxy reproduce los mensajes de WebSocket grabados ([CLI](/es/docs/guides/cli/#websocket-replay-pacing)). Versión: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** Con `update: true` graba un HAR a partir de tráfico real ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). La reproducción sirve «las peticiones de red que se hacen en la página» ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). Pasa por handlers de `route()` que responden peticiones HTTP y no tiene ninguna vía para WebSocket ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Versión: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** Los handlers de las peticiones los escribes tú. MSW no graba nada por sí mismo, pero [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) puede generar handlers a partir de un archivo HAR que exportes desde las DevTools del navegador. En Node.js se ejecuta dentro del proceso que hace las peticiones ([`setupServer`](https://mswjs.io/guides/integrations/node)). Los WebSockets usan la [API `ws`](https://mswjs.io/docs/websocket). La integración oficial [`@msw/playwright`](https://github.com/mswjs/playwright) enruta a través de `page.route()`, así que cubre las peticiones del navegador. Versión: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** Su [repositorio](https://github.com/Netflix/pollyjs) lo describe como «grabar, reproducir y simular interacciones HTTP». El [adaptador node-http](https://netflix.github.io/pollyjs/#/adapters/node-http) parchea los módulos `http` y `https` de Node, y el [adaptador fetch](https://netflix.github.io/pollyjs/#/adapters/fetch) envuelve el `fetch` global. Por tanto, Polly graba dentro del proceso que lo ejecuta. Su documentación no incluye ningún adaptador de WebSocket. El soporte de Playwright lo da el paquete de terceros [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), al que enlaza la [documentación de Polly](https://netflix.github.io/pollyjs/#/adapters/playwright). Versión: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** Su [README](https://github.com/vitalets/playwright-network-cache) dice que acelera las pruebas de Playwright «guardando en caché las peticiones de red en el sistema de archivos». `CacheRoute` intercepta con `page.route()` ([código fuente](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), así que solo ve las peticiones del navegador. Versión: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** Defines los mocks en la prueba, para las peticiones del servidor y del cliente, con una sola API. Los mocks se mantienen aislados por prueba mientras las pruebas se ejecutan en paralelo ([características](https://docs.mockybalboa.com/docs/features/)). Para Next.js 14 y posteriores, su CLI arranca tu servidor de Next.js ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). Su documentación solo menciona WebSocket como el canal entre tu servidor y el runner de pruebas. Versión: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Modo de prueba de Next.js.** Los handlers registrados con `next.onFetch()` reciben las llamadas `fetch` del servidor, además de las llamadas `fetch` de la página a otros orígenes ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). [Mocking del lado del servidor](/es/docs/guides/server-side-mocking/#nextjs-test-mode) cubre su configuración, su estado y MSW 3. Versión: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** Un servidor de mocks y proxy HTTP y HTTPS para pruebas que se ejecutan «en node o en navegadores» ([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()` hace mock de las conexiones WebSocket ([código fuente](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). El README no describe ningún modo de grabación. La [publicación](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) del equipo de Playwright muestra el fixture que hay que escribir. Versión: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** El [README](https://github.com/citypaul/scenarist) dice que está «construido sobre MSW con gestión de escenarios en tiempo de ejecución y aislamiento por ID de prueba», y los escenarios los escribes en código. Su FAQ dice que «proporciona gestión de escenarios del lado del servidor, que complementa el mocking del lado del cliente de Playwright». El código de tu servidor reenvía `x-scenarist-test-id` en cada `fetch` ([adaptador de Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), y `@scenarist/playwright-helpers` proporciona el fixture de Playwright. Versión: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** «Un proxy HTTP en JavaScript que graba y reproduce peticiones HTTP» ([README](https://github.com/ijpiantanida/talkback)). Tu app envía sus peticiones a talkback. Una petición que coincide con una cinta (tape) guardada recibe la respuesta de esa cinta, y una desconocida se reenvía al host y se guarda como una cinta nueva. El README no menciona ni navegadores ni cintas por prueba. Versión: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** Un proxy de grabación y reproducción para «un frontend web y su backend» o «un servidor y otro servidor» ([README](https://github.com/airtasker/proxay)). Las pruebas eligen una cinta con `POST /__proxay/tape`, por ejemplo en `beforeEach`, y el README no trata las pruebas en paralelo. La versión 2.0.0 es una [release de GitHub](https://github.com/airtasker/proxay/releases/tag/v2.0.0); [npm](https://www.npmjs.com/package/proxay) sigue sirviendo la 1.9.0.

## Alternativa a Polly.js para Playwright {#pollyjs}

Polly.js, de Netflix, graba, reproduce y simula HTTP, y es la inspiración de test-proxy-recorder. Su estado a 2026-10-03:

- `@pollyjs/core` no ha tenido ninguna versión nueva desde la 6.0.6 del 2023-07-20. El último cambio del repositorio, el 2025-05-31, publicó `@pollyjs/adapter-fetch` 6.0.7, que dejó de marcar como obsoleto el adaptador fetch para Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Polly no tiene un adaptador propio para Playwright. Su documentación remite al paquete de terceros [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), que se conecta a un contexto de navegador o a una página. Su última versión, la 2.4.0, salió el 2024-04-18.
- Para las llamadas del lado del servidor, Polly tiene que ejecutarse dentro del proceso del servidor, mediante su adaptador node-http o fetch.

Si vienes de Polly.js, sus conceptos se corresponden con los de test-proxy-recorder de la siguiente manera.

| Polly.js | test-proxy-recorder |
| --- | --- |
| Modos `record`, `replay` y `passthrough` ([configuración](https://netflix.github.io/pollyjs/#/configuration)) | Modos `record`, `replay` y `transparent`, que `playwrightProxy.before()` establece por prueba |
| Una grabación con nombre por instancia de Polly, guardada por un persister | Un `.mock.json` (servidor) y un `.har` (navegador) por prueba de Playwright, en el directorio de grabaciones |
| Adaptadores dentro del proceso que hace las peticiones | Un proceso proxy para las llamadas del servidor, HAR para las del navegador y `registerProxyFetch()` en el servidor |
| Peticiones emparejadas por método, cabeceras, cuerpo, orden y URL por defecto | Peticiones del lado del servidor emparejadas por método, ruta y un hash de la cadena de consulta (query string), en el orden grabado y sin comparar los cuerpos. Las peticiones del navegador siguen las reglas de HAR de Playwright, que también comparan los cuerpos de los POST |

## MSW con Next.js y Playwright {#msw}

En una app de Next.js, las peticiones del navegador y las del servidor necesitan configuraciones de MSW distintas.

- **Peticiones del navegador.** [`@msw/playwright`](https://github.com/mswjs/playwright), la integración oficial, ejecuta tus handlers a través de `page.route()`, con un fixture `network` que puedes cambiar por prueba.
- **Peticiones del servidor.** MSW se ejecuta dentro del proceso de Next.js. La documentación de MSW no tiene una guía para Next.js, y el ejemplo de referencia es un pull request abierto, [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Los handlers que cambias en tiempo de ejecución los comparten todas las pruebas que llegan a ese servidor. [Mocking del lado del servidor](/es/docs/guides/server-side-mocking/#msw) tiene los detalles y las fuentes.
- **Handlers de servidor por prueba.** El modo de prueba de Next.js acepta handlers de MSW por prueba, pero su punto de entrada de MSW no se carga con MSW 3.0 ([detalles](/es/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist construye escenarios por prueba sobre MSW para Next.js y Express, y el código de tu servidor reenvía una cabecera con el id de la prueba en cada `fetch`.
- **Grabación.** MSW no graba tráfico. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) convierte en handlers un archivo HAR exportado desde las DevTools del navegador.

test-proxy-recorder hace la concesión contraria. Graba ambos lados desde la API real, así que no hay handlers que escribir. A cambio, tienes menos control sobre las respuestas que la API no produce a petición.

## Cuándo usar otra cosa {#when-to-use-something-else}

- **Todo tu tráfico es del lado del navegador.** El `routeFromHAR` integrado de Playwright no necesita ninguna dependencia extra. Empieza por ahí y añade test-proxy-recorder cuando aparezcan peticiones del lado del servidor.
- **Quieres escribir las respuestas a mano o forzar errores y casos límite.** Los handlers de MSW encajan mejor para eso, y MSW también funciona en [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook) y [el navegador](https://mswjs.io/guides/integrations/browser), no solo en Playwright. Para handlers del lado del servidor por prueba en Playwright, mira Mocky Balboa, scenarist o el modo de prueba de Next.js.
- **Solo necesitas una caché del lado del navegador con poca configuración.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) guarda las respuestas en caché en disco mediante un solo fixture.
- **Tu servidor no está escrito en JavaScript, o no puedes cambiar su código.** Un proxy de reenvío como mockttp funciona a través de `HTTPS_PROXY`. La [publicación](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) del equipo de Playwright dice que Python, Go, Ruby, Rust y .NET funcionan igual, y que Java necesita `-Dhttps.proxyHost` y `-Dhttps.proxyPort`.
- **Necesitas grabar y reproducir fuera de Playwright, en cualquier lenguaje.** proxay y talkback son servidores HTTP independientes que guardan las grabaciones como archivos de cinta.
