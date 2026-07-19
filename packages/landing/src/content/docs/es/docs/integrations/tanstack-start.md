---
title: TanStack Start
description: Marca los fetch del lado del servidor de TanStack Start con la cabecera de sesión de grabación para grabar y reproducir el SSR — mediante registerProxyFetch (recomendado) o createHeadersWithRecordingId por llamada.
---

TanStack Start ejecuta los loaders y las server functions en el servidor, por lo que sus llamadas `fetch` pasan por el proxy sin un contexto de navegador — la misma situación que el [SSR de Next.js](/es/docs/integrations/nextjs/). El proxy identifica a qué sesión pertenecen esas peticiones mediante la cabecera `x-test-rcrd-id`. El `playwrightProxy.before()` de Playwright ya la establece en la navegación del navegador que dispara el SSR, así que el id llega en la petición entrante del servidor — el trabajo consiste en **adjuntarlo a las peticiones salientes del lado del servidor**. (Las pruebas solo de navegador no necesitan nada de esto; el proxy recurre a la sesión establecida globalmente.)

:::caution[Graba contra un build de producción]
Graba con `vite build` + `node .output/server/index.mjs` (es decir, `pnpm start`), no con `vite dev`. El contexto por petición del servidor de desarrollo difiere del runtime de producción que `registerProxyFetch()` parchea. Como el servidor de producción se ejecuta en modo producción, establece `TEST_PROXY_RECORDER_ENABLED=true` en el proceso de la aplicación para tu ejecución e2e.
:::

## registerProxyFetch (recomendado)

Una línea en la **configuración de tu router** marca cada `fetch` del lado del servidor — loaders de ruta, server functions y server routes:

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // sin efecto en el cliente / en producción salvo que TEST_PROXY_RECORDER_ENABLED=true
```

Parchea el `fetch` global para copiar el `x-test-rcrd-id` de la petición actual en las peticiones salientes, leyéndolo del contexto de petición del servidor de TanStack Start (`getRequestHeader`). Colócalo al principio de `src/router.tsx` — ese módulo se ejecuta en el servidor en cada petición SSR; la llamada es idempotente, sin efecto en el cliente y sin efecto en producción salvo que la grabadora esté habilitada explícitamente.

## Por llamada — createHeadersWithRecordingId

Sin parcheo. Úsalo para un único fetch dentro de un loader o una server function, o cuando prefieras no parchear el `fetch` global:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

También se exporta `getRecordingId()` si quieres el id en bruto (o `null`) para reenviarlo tú mismo. Ambos leen el id de la petición actual desde el contexto del servidor, y ambos son sin efecto en producción salvo que `TEST_PROXY_RECORDER_ENABLED=true`.

## Apunta la aplicación al proxy

En dev/test, apunta las URLs base de tu backend al proxy para que **ambos** orígenes se graben — la base del lado del servidor (leída por los loaders / server functions, p. ej. `BACKEND_URL`) y la base del lado del navegador incrustada en el build (`VITE_API_URL`). En producción, apúntalas al backend real. Las peticiones del lado del navegador las gestiona el mecanismo HAR de `playwrightProxy.before()`, exactamente como en la [configuración manual](/es/docs/getting-started/manual-setup/).

## Ejemplo completo

Una aplicación completa y ejecutable — construida con **TanStack Query** (precarga en SSR + `useMutation`), que cubre todos (navegador + SSR), una ruta ISR basada en cabeceras de caché, un caso de redacción (ocultación) y un chat WebSocket, todo grabado y reproducido — se encuentra en [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Demuestra que la grabadora es transparente para tu capa de datos: `registerProxyFetch()` marca los fetch del `queryFn` de Query durante el SSR, sin código específico de Query.
