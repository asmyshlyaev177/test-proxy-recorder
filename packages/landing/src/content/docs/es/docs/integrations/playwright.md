---
title: Playwright
description: Usa test-proxy-recorder desde pruebas de Playwright — el hook de sesión before(), el teardown global recomendado y dónde acaban los archivos de grabación.
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

**Excepción — apps full-stack:** cuando el navegador también llama a `localhost:8100` (porque el frontend está configurado con la URL del proxy como su base de API), usa `/localhost:8100/` como patrón.

Los nombres de archivo de grabación se derivan de los nombres de las pruebas (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Teardown global (recomendado)

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

`teardown()` reinicia el proxy a `transparent` y ejecuta la pasada de [redacción](/es/docs/guides/secret-redaction/) de HAR. No lo llames en un hook `afterAll` por prueba bajo `fullyParallel` — mira en las [preguntas frecuentes](/es/docs/reference/faq/#parallel-replay) por qué eso rompe la reproducción en paralelo.

## Archivos de grabación

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
