---
title: Preguntas frecuentes
description: Preguntas comunes sobre test-proxy-recorder — reproducción en paralelo, commit de grabaciones a git, el destino del proxy para grabación HAR, el servidor de desarrollo de Next.js y actualización de grabaciones.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
---

## Mis pruebas de reproducción en paralelo a veces llaman al backend real — ¿por qué? {#parallel-replay}

Probablemente estás llamando a `playwrightProxy.teardown()` en un hook por prueba. Establece el modo **global** del proxy a `transparent`, y con `fullyParallel: true` cada worker de Playwright ejecuta su propio `test.afterAll`. Si una prueba rápida termina y llama a `teardown()` mientras otra más lenta sigue en marcha, el proxy cambia a transparent en mitad de la prueba y las peticiones restantes se reenvían al backend real en vez de reproducirse.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Solución:** omite `test.afterAll`. La limpieza de sesión es automática vía `context.on('close')` → `cleanupSession()`. Usa un [global teardown](https://playwright.dev/docs/test-global-setup-teardown) solo si necesitas reiniciar el proxy tras toda la ejecución.

El timeout de sesión es la otra forma en que una ejecución de reproducción llega al backend real. Cada llamada a `playwrightProxy.before()` lo reinicia, y las peticiones que pasan por el proxy no. Si se agota (120000 ms por defecto) antes de la siguiente llamada a `before()`, el proxy cambia a `transparent`. Una prueba que siga en marcha envía entonces sus peticiones restantes al backend real. Si una prueba puede durar tanto, aumenta el timeout con `--timeout` en la [CLI](/es/docs/guides/cli/) o con `timeout` en la [configuración](/es/docs/guides/config/).

## ¿Puedo grabar con workers en paralelo? {#parallel-recording}

No. El proxy mantiene una sola sesión de grabación a la vez. Cuando una segunda prueba empieza a grabar, el proxy guarda el archivo de la primera prueba y cambia a la segunda. Las peticiones restantes de la primera prueba que pasan por el proxy acaban entonces en el `.mock.json` de la segunda. Graba con un solo worker, como ya hace el script `test:e2e:record` que añade `init`:

```bash
npx playwright test --workers 1
```

La reproducción sí puede ejecutarse con workers en paralelo. Cada prueba reproduce su propia sesión, y la cabecera `x-test-rcrd-id` las distingue: `playwrightProxy.before()` la establece en las peticiones de la página, y `registerProxyFetch()` la copia en las del lado del servidor. Por eso las [apps de ejemplo](/es/docs/reference/examples/) graban con `--workers 1`.

## ¿Debo hacer commit de las grabaciones a git?

Sí. Las grabaciones deben estar en git para que CI pueda reproducirlas sin red — **no** añadas `e2e/recordings` a `.gitignore`. Para evitar que los archivos de grabación grandes saturen las revisiones de PR, márcalos como generados en `.gitattributes`: GitHub colapsa sus diffs por defecto y aun así los muestra con un clic, de modo que un campo que la API haya renombrado sigue viéndose en la revisión. Marcarlos como `binary` ocultaría ese cambio por completo.

```text
/e2e/recordings/** linguist-generated=true
```

## ¿Importa el `<target-url>` del proxy para la grabación solo de navegador (HAR)?

No. Para la grabación solo de navegador el destino es irrelevante — el proceso del proxy solo necesita ejecutarse para que su endpoint `/__control` esté disponible para la gestión de sesiones. El destino solo importa cuando también se enrutan peticiones del lado del servidor (SSR) por el proxy.

## ¿Qué pasa con las peticiones del navegador fuera del patrón `url`? {#outside-url}

Playwright no las intercepta, así que van a la red real tanto al grabar como al reproducir. No se guarda nada de ellas. Las peticiones al proxy (`localhost:8100`) son la excepción. `playwrightProxy.before()` siempre las reenvía al proxy, que las graba y las reproduce por su cuenta.

Para mantener una prueba fuera de la red, amplía `url` para que el HAR cubra el dominio, o bloquea el dominio con `page.route()` y `route.abort()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // El HAR también graba y reproduce la CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Las llamadas de analítica fallan en lugar de llegar a la red.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

Los detalles están en [cómo se emparejan las peticiones al reproducir](/es/docs/getting-started/how-it-works/#replay-matching).

## ¿Puedo grabar contra el servidor de desarrollo de Next.js?

Prefiere `next build` + `next start` antes que `next dev` para grabar y reproducir. El servidor de desarrollo es lento y puede provocar timeouts o grabaciones inestables.

## ¿Cómo actualizo una grabación?

Vuelve a ejecutar en modo record (`RECORD_MODE=1`, el script `test:e2e:record`) contra la API real y luego haz commit de los archivos actualizados en `e2e/recordings/`.

## ¿Puedo forzar un error, una lista vacía o una respuesta lenta en una prueba reproducida? {#override-responses}

Sí, para las peticiones del navegador. Playwright ejecuta los route handlers [en orden inverso al de registro](https://playwright.dev/docs/api/class-route#route-fallback), así que un `page.route()` añadido después de `playwrightProxy.before()` ve cada petición primero. Puede responder él mismo a la petición, o llamar a `route.fallback()` para pasarla a las grabaciones.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Añadido después de before(), así que Playwright ejecuta este handler primero.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // todas las demás peticiones se reproducen tal como se grabaron
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

Para una lista vacía, responde en su lugar con `json: []`. Para una respuesta lenta, espera antes de llamar a `route.fallback()`, por ejemplo con `await new Promise((resolve) => setTimeout(resolve, 3000))`. La respuesta grabada llega entonces con tres segundos de retraso.

Las peticiones del lado del servidor nunca pasan por el navegador, así que `page.route()` no puede cambiarlas. Para esas, edita a mano la grabación en el `.mock.json`, o graba contra una API que esté en el estado que necesitas. En el archivo, el `response` de cada grabación contiene `statusCode`, `headers` y `body`. Si cambias la longitud del cuerpo, borra también la cabecera `content-length`.

## ¿Puedo usarlo cuando la suite prueba un entorno desplegado? {#deployed-environment}

Sí, para las peticiones del navegador. Playwright las intercepta en el navegador, así que el HAR las graba y las reproduce sin cambios en la app desplegada. Apunta `url` al dominio de la API al que llama el navegador. El proxy tiene que seguir ejecutándose junto a las pruebas, porque `playwrightProxy.before()` establece el modo de cada prueba a través de su endpoint `/__control`.

Las peticiones del lado del servidor las hace el servidor de la app, así que un proxy en CI nunca ve las que hace un servidor desplegado. Para grabarlas o reproducirlas, ejecuta el servidor de la app en CI junto al proxy. Compílalo y arráncalo para la ejecución de las pruebas con su URL base de la API apuntando al proxy y con `TEST_PROXY_RECORDER_ENABLED=true` definida. Las páginas de [Next.js](/es/docs/integrations/nextjs/) y [TanStack Start](/es/docs/integrations/tanstack-start/) muestran esta configuración.
