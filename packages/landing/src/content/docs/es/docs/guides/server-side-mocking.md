---
title: 'Mock de peticiones del lado del servidor en Playwright (Next.js, TanStack Start)'
description: 'Por qué page.route() no ve los fetch del lado del servidor en Next.js y TanStack Start, y cómo los gestionan en Playwright el modo de prueba, MSW, mockttp o las respuestas grabadas.'
sidebar:
  label: Mocking del lado del servidor
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: 6fd6662395c2237b6c951527806be5bd6116dec1
---

En una app de Next.js o TanStack Start, el servidor llama a tu API mientras renderiza una página. El mocking de peticiones de Playwright nunca ve esas llamadas. Las secciones siguientes explican por qué y luego comparan cuatro formas de controlarlas en una prueba de Playwright: el modo de prueba de Next.js (Next.js test mode), MSW dentro del servidor, un proxy de reenvío (forward proxy) como mockttp y la grabación de respuestas reales con test-proxy-recorder. Los datos sobre las demás herramientas se comprobaron con su propia documentación y su código fuente el 2026-10-03.

## Por qué `page.route()` no ve las peticiones del lado del servidor {#why}

El [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) de Playwright actúa sobre las «peticiones de red que hace una página». En cambio, un Server Component, un loader de ruta o una server function se ejecutan en el proceso Node.js de tu app. Su `fetch` va desde ese proceso directamente a la API. La petición nunca pasa por el navegador, así que Playwright no tiene nada que interceptar. `page.route()` sí ve la petición de la página que el navegador envía a tu app, y el HTML que vuelve. Nunca ve las peticiones que hizo el servidor para construir ese HTML.

Los archivos HAR tienen el mismo límite, porque [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) sirve «las peticiones de red que se hacen en la página».

La [comparación de MSW con Playwright](https://mswjs.io/docs/comparison#playwright) dice lo mismo: `page.route()` afecta «al tráfico del navegador lanzado, no al proceso de Node.js». La [publicación del equipo de Playwright sobre el mocking del lado del servidor](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) dice que `page.route()` funciona para las peticiones del navegador, y «para las llamadas HTTP del lado del servidor, no». La solicitud de funcionalidad para integrar el mocking del lado del servidor, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), se cerró el 2026-05-22 con un enlace a esa publicación.

## Modo de prueba de Next.js {#nextjs-test-mode}

Next.js incluye una integración experimental con Playwright en `next/experimental/testmode/playwright`. Su única documentación es un [README en el repositorio de Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), y la [guía de Playwright de Next.js](https://nextjs.org/docs/app/guides/testing/playwright) no la menciona. Una prueba registra handlers con `next.onFetch()`, y Next.js les envía las llamadas `fetch` del servidor:

```typescript
// Abreviado del README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

Lo que necesita:

- `experimental: { testProxy: true }` en `next.config.js`.
- Un `playwright.config.ts` creado con `defineConfig` de `next/experimental/testmode/playwright`, y pruebas que importen `test` del mismo módulo.

Por dentro, cada worker de Playwright arranca un pequeño servidor proxy. El fixture añade a las peticiones de la página una cabecera `Next-Test-Proxy-Port` (ese proxy) y una cabecera `Next-Test-Data` (el id de la prueba) ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). Con `testProxy` activado, el servidor lee esas cabeceras y envía cada `fetch` del lado del servidor a ese proxy. El proxy entrega la petición a los handlers de esa prueba ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Los handlers se guardan por id de prueba, así que las pruebas en paralelo pueden compartir un mismo servidor de Next.js. Un fetch del servidor al que no responde ningún handler lanza `Proxy request aborted`. En su lugar, un handler puede devolver `'continue'` para dejar pasar la petición. `next.onFetch()` también recibe las llamadas `fetch` de la propia página a otros orígenes.

Estado:

- Experimental. Tanto la ruta de importación como la clave de configuración lo indican, y el README se titula «Experimental test mode for Playwright».
- Sigue recibiendo correcciones. La más reciente, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), se fusionó el 2026-08-13.
- El README también ofrece handlers de MSW por prueba a través de `next/experimental/testmode/playwright/msw`. Con MSW 3.0 (publicado el 2026-09-28) ese punto de entrada no llega a cargarse. Importa `strict-event-emitter`, del que MSW 3.0 ya no depende. También llama a `handleRequest()` de MSW, que la 3.0 eliminó ([notas de la versión 3.0 de MSW](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). Con MSW 2.15.0 sí se carga. Ambos resultados son de Next.js 16.3.8, comprobados el 2026-10-03.

## MSW en el servidor de Next.js {#msw}

MSW intercepta peticiones en Node.js con `setupServer` de `msw/node` ([integración con Node.js](https://mswjs.io/guides/integrations/node)). Su documentación no tiene una guía para Next.js. Cuando el autor de MSW cerró el issue sobre el App Router, señaló [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) como la referencia de integración ([comentario](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). Ese pull request está abierto desde el 2024-01-22. Arranca el interceptor desde el root layout, con una lista fija de handlers:

```tsx
// app/layout.tsx, de mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

Los handlers viven entonces en el proceso de Next.js. El ejemplo arranca ese proceso con el `webServer` de Playwright, que ejecuta un solo proceso para toda la ejecución ([publicación del equipo de Playwright](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Todos los workers envían sus páginas a ese único servidor, y los workers en paralelo cambian cómo se comportan sus handlers:

- Una prueba no puede llamar a `server.use()` en ese servidor, porque la prueba se ejecuta en su propio proceso de worker. MSW no tiene ninguna API publicada para cambiar handlers en otro proceso. La propuesta, `setupRemoteServer` en [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617), está abierta desde el 2023-05-12. La integración de MSW para Playwright dice que depende de `page.route()` hasta que eso se publique ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- Si añades tu propio canal, como una ruta de API que llame a `server.use()`, el cambio llega a todas las pruebas. Los handlers añadidos con [`server.use()`](https://mswjs.io/api/setup-server/use) «persisten en la instancia del servidor». La [publicación que presenta server boundary](https://mswjs.io/blog/introducing-server-boundary) explica que las sobrescrituras concurrentes en un mismo servidor se convierten en «un estado global compartido entre todas las pruebas». En #1617, el autor de MSW señala que, en la práctica, o mantienes «una lista fija de handlers» o arrancas «una instancia de la app por caso de prueba».

En la práctica, MSW dentro de un servidor de Next.js compartido da las mismas respuestas a todas las pruebas en paralelo. Dos herramientas añaden handlers por prueba sobre MSW. El modo de prueba de Next.js acepta handlers de MSW (con MSW 2, ver arriba). [scenarist](https://github.com/citypaul/scenarist) identifica los escenarios por una cabecera `x-scenarist-test-id` que el código de tu servidor reenvía en cada `fetch` ([adaptador de Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## Un proxy de reenvío como mockttp {#mockttp}

Cuando el equipo de Playwright cerró #30766, [remitió](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) a la [publicación](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) de Simon Knott. Esta pone [mockttp](https://github.com/httptoolkit/mockttp), un servidor de mocks y proxy HTTP y HTTPS, delante del tráfico saliente del servidor. Cada prueba le añade reglas, como `mocks.forPost(url).thenJson(200, body)`.

El código de la app no cambia. Su proceso de servidor arranca con variables de entorno que envían las peticiones salientes a través del proxy:

- `HTTP_PROXY` y `HTTPS_PROXY` con la URL del proxy.
- `NODE_USE_ENV_PROXY=1`, para que el `fetch` integrado de Node use esas variables. Node.js la añadió en 24.0.0 y 22.21.0, y la marca como en desarrollo activo ([documentación de Node.js](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS` apuntando al certificado de CA del proxy, para que el servidor confíe en los certificados que mockttp genera para los hosts HTTPS.

El proxy pertenece a un worker de Playwright, así que la publicación arranca un servidor de la app por worker desde un fixture de worker, cada uno en un puerto libre. Evita el `webServer` de Playwright, que arranca un solo proceso para toda la ejecución antes de que exista ningún worker. En la configuración de la publicación, las peticiones sin regla pasan a la API real. La publicación sugiere responderlas con un error, para que un mock olvidado salga a la luz.

El equipo de Playwright describe el enfoque como «independiente del lenguaje y del framework del servidor». La propia publicación usa un servidor Node sencillo, no Next.js ni TanStack Start.

## Grabar respuestas reales con test-proxy-recorder {#test-proxy-recorder}

Con las tres opciones anteriores, escribes tú cada respuesta. test-proxy-recorder graba lo que devuelve tu API real durante una ejecución local y luego lo reproduce en CI.

- **El proxy.** Arranca `test-proxy-recorder <target-url>` junto a tu app para la ejecución de las pruebas. Apunta la URL base de la API de la app hacia él mientras `TEST_PROXY_RECORDER_ENABLED` esté definida. Cada proxy reenvía a un solo backend, el `<target-url>` con el que se arrancó.
- **`registerProxyFetch()`.** Una llamada en el servidor parchea el `fetch` global. Copia la cabecera `x-test-rcrd-id` de la petición actual en cada petición saliente. El proxy lee esa cabecera para archivar cada llamada del lado del servidor bajo su prueba. La llamada es un no-op en producción salvo que `TEST_PROXY_RECORDER_ENABLED` esté definida.
- **El id por prueba.** `playwrightProxy.before(page, testInfo, mode)` construye un id de sesión a partir del archivo de spec, sus títulos de `describe` y el título de la prueba. Envía ese id como `x-test-rcrd-id` en las peticiones de la página y cambia esa sesión a `record` o `replay`. Los workers en paralelo comparten un mismo servidor de la app y un mismo proxy, y aun así cada prueba obtiene su propia grabación.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Graba una vez contra la API real y haz commit de los archivos `.mock.json` (servidor) y `.har` (navegador). Después, CI los reproduce con el backend apagado. Al reproducir, una petición sin grabación recibe un 404 que la identifica. Nunca llega a la API.

Las respuestas grabadas solo cubren lo que hizo la API mientras grababas. Para forzar un error o un caso límite que la API no produce a petición, un handler escrito a mano con una de las opciones anteriores es más sencillo.

Los detalles de configuración están en las guías de [Next.js](/es/docs/integrations/nextjs/) y [TanStack Start](/es/docs/integrations/tanstack-start/).

## Comparar las opciones {#comparison}

| Opción | Configuración en la app | Pruebas en paralelo | Handlers o respuestas grabadas | Next.js y TanStack Start |
| --- | --- | --- | --- | --- |
| [Modo de prueba de Next.js](#nextjs-test-mode) | `experimental.testProxy` en `next.config.js` | Sí, los handlers se guardan por prueba | Handlers (`next.onFetch()` o handlers de MSW 2) | Solo Next.js |
| [MSW en el servidor](#msw) | `setupServer` arrancado en el código del servidor (el root layout en el ejemplo de MSW) | Un único conjunto de handlers para todas las pruebas de ese servidor | Handlers | Next.js: un ejemplo en un pull request abierto. TanStack Start: no documentado |
| [mockttp](#mockttp) | Sin cambios de código. Variables de proxy y un certificado de CA en el proceso del servidor | Sí, con un servidor de la app por worker | Handlers. Las peticiones sin regla se dejan pasar | No documentado. El equipo de Playwright lo considera independiente del framework |
| [test-proxy-recorder](#test-proxy-recorder) | URL base de la API apuntando al proxy durante las pruebas, más `registerProxyFetch()` | Sí, con un servidor de la app compartido | Grabadas de la API real | Ambos documentados |

La [comparación](/es/docs/reference/comparison/) cubre más herramientas, entre ellas Mocky Balboa, scenarist, Polly.js, talkback y proxay, además de las opciones del lado del navegador.
