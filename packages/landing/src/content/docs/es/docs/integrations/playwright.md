---
title: 'Configuración de Playwright: graba y reproduce cada prueba'
description: Graba y reproduce llamadas a la API en pruebas de Playwright con test-proxy-recorder, usando el hook de sesión before(), el teardown global recomendado y archivos de grabación por prueba.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 26b8b462ae4153046421443a751392892c37c34b
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

Llama a esto al inicio de cada prueba (o en un `beforeEach` / fixture de página). Establece el modo del proxy para la sesión y, si se proporciona `url`, configura la grabación HAR para peticiones del lado del navegador.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**Patrón `url`:** coincide con el dominio externo real que llama el navegador. En modo record las peticiones van a la API real y se guardan en un archivo `.har`. En modo replay se sirven desde ese archivo — sin red. Este patrón **no** apunta al proxy (`localhost:8100`).

**Excepción — apps full-stack:** cuando el navegador también llama a `localhost:8100` (porque el frontend está configurado con la URL del proxy como su base de API), usa `/localhost:8100/` como patrón. Esas peticiones del navegador pasan entonces al proxy, que las graba en el `.mock.json` de la prueba y las reproduce desde él, así que una que falte recibe el 404 del proxy en lugar de que HAR la aborte (mira [cómo se emparejan las peticiones al reproducir](/es/docs/getting-started/how-it-works/#replay-matching)).

Los nombres de archivo de grabación se derivan de los nombres de las pruebas (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Teardown global (recomendado) {#global-teardown-recommended}

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` reinicia el proxy a `transparent` y ejecuta la pasada de [enmascaramiento](/es/docs/guides/secret-redaction/) de HAR. No lo llames en un hook `afterAll` por prueba bajo `fullyParallel` — mira en las [preguntas frecuentes](/es/docs/reference/faq/#parallel-replay) por qué eso rompe la reproducción en paralelo.

## Archivos de grabación

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
