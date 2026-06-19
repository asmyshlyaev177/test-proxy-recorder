---
title: Next.js
description: Etiqueta los fetch del lado del servidor de Next.js con la cabecera de sesión de grabación para que el SSR se grabe y reproduzca — vía registerProxyFetch (recomendado, cualquier runtime), registerProxyAxios para axios, o createHeadersWithRecordingId por llamada. El middleware es opcional.
---

Los frameworks SSR como Next.js hacen llamadas `fetch` del lado del servidor que pasan por el proxy sin un contexto de navegador. El proxy identifica a qué sesión pertenecen esas peticiones mediante la cabecera `x-test-rcrd-id`. El `playwrightProxy.before()` de Playwright ya la establece en la navegación del navegador que dispara el SSR, así que el id está disponible en `next/headers` — el trabajo es **adjuntarlo a las peticiones salientes del lado del servidor**. (Las pruebas solo de navegador no necesitan nada de esto; el proxy recurre a la sesión establecida globalmente.)

:::tip
[`test-proxy-recorder init`](/es/docs/getting-started/quick-start/) detecta Next.js y cablea automáticamente el enfoque recomendado de abajo en tu root layout.
:::

:::caution[Graba contra un build de producción]
Graba con `next build && next start`, no `next dev`. El servidor de desarrollo puede resetear el parche global de `fetch` entre peticiones ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), y es más lento/inestable. Como `next start` se ejecuta en modo producción, establece `TEST_PROXY_RECORDER_ENABLED=true` en el proceso de la app para tu ejecución e2e.
:::

## registerProxyFetch (recomendado)

Una línea en tu **root layout** etiqueta cada `fetch` del lado del servidor — Server Components, Route Handlers, en los runtimes Node **y** Edge:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op en producción salvo TEST_PROXY_RECORDER_ENABLED=true
```

Parchea el `fetch` global para copiar el `x-test-rcrd-id` de la petición actual en las peticiones salientes, de modo que el proxy pueda distinguir sesiones de reproducción concurrentes. Llámalo desde el root layout — **no** desde `instrumentation.ts`, cuyo contexto difiere del que renderiza tus rutas en el runtime Edge, así que un parche allí nunca se dispara de forma silenciosa.

## axios — registerProxyAxios

Si tus peticiones del lado del servidor van por axios, registra cada instancia del lado del servidor una vez:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

Añade un interceptor de petición que estampa el id (sin tocar el `fetch` global), así que es inmune a la advertencia del servidor de desarrollo de arriba. No-op en producción / en el navegador; idempotente por instancia; nunca sobrescribe un id establecido por el llamador.

## Por llamada — createHeadersWithRecordingId

Sin parchear, y funciona también bajo `next dev`. Úsalo para un único fetch, o cuando prefieras no parchear el `fetch` global:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (opcional)

Un `proxy.ts` (Next.js 16+, función exportada `proxy`) o `middleware.ts` (15 y anteriores, función exportada `middleware`) que llame a `setNextProxyHeaders` hace el id disponible vía `next/headers`, pero **no etiqueta los fetch salientes** — así que no es necesario si usas uno de los helpers de arriba. Recurre a él solo si ya tienes un middleware (auth, etc.), y aún así combínalo con un helper para hacer el etiquetado:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // expone el id; combínalo con un helper de arriba
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Mira la [referencia de la API](/es/docs/reference/api/readme/) para las firmas completas de los helpers de `test-proxy-recorder/nextjs`. Un proyecto Edge completo y ejecutable vive en el [ejemplo de runtime Edge](https://github.com/asmyshylaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

## Caché e ISR

No deshabilites el cacheo para las pruebas — el grabador funciona con una ruta cacheada/ISR. Pero hay una regla que define todo el diseño: **para reproducir un fetch SSR, la página debe ejecutar ese fetch en el momento de la petición.** Una ruta que sirve HTML prerenderizado o un render cacheado obsoleto nunca hace el fetch, así que el proxy no tiene nada que servir y la aserción ve contenido obsoleto.

La forma que se mantiene determinista es cachear el fetch SSR con `next.revalidate` + `next.tags` a nivel de fetch, y luego invalidar bajo demanda antes de la aserción:

```tsx
// app/isr/page.tsx — sin `export const dynamic`, sin `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // Next.js 16 requiere el 2º argumento de perfil
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // purga dura
await page.goto('/isr');                     // una navegación — determinista
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

`revalidateTag` sobre una entrada de caché de **fetch** es una *purga dura*: la siguiente lectura es un fallo de caché que se bloquea y vuelve a hacer el fetch a través del proxy. Debes purgar antes de la navegación de reproducción porque la caché de datos sobrevive entre las fases de grabación → reproducción de un mismo proceso `next start` — de lo contrario la reproducción sirve la caché de la fase de grabación y nunca llega al proxy (un falso positivo).

Durante las pruebas el `fetch` parcheado lee `headers()`, así que la página se renderiza dinámicamente y realmente ejecuta el fetch. En producción (grabador deshabilitado) nada lee `headers()` y la página es ISR estática como siempre — el render dinámico está acotado a las pruebas, y es intrínseco a grabar un fetch SSR.

:::caution[Evita `unstable_cache` para esto]
`unstable_cache` es *stale-while-revalidate*: `revalidateTag` marca su entrada como obsoleta, la siguiente lectura devuelve el valor obsoleto y regenera en **segundo plano**, así que el valor fresco llega después de tu aserción — inestable, incluso en una página `force-dynamic` e incluso con una petición de calentamiento. Usa `next.tags` a nivel de fetch (una purga dura) en su lugar.
:::

La revalidación bajo demanda es privilegiada (purga la caché y fuerza la regeneración), así que protege la ruta con un secreto compartido — falla en cerrado si no está definido, compara en tiempo constante, y adjunta el token desde la prueba vía `use.extraHTTPHeaders` de Playwright para que el spec nunca lo maneje.

Mira el ejemplo completo y ejecutable (parte del [ejemplo de Next.js 16](/es/docs/reference/examples/#nextjs-16)):

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — la página cacheada (`next.tags` a nivel de fetch)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — cómo proteger `revalidateTag`: falla en cerrado + comparación del secreto en tiempo constante
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — invalida, luego una navegación; comprueba que la llamada de revalidación tuvo éxito
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — carga `.env` y adjunta el secreto vía `extraHTTPHeaders`

## Scripts de package.json

Inicia los servicios desde scripts, no desde `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

Un proyecto completo y ejecutable vive en el [ejemplo de Next.js 16](/es/docs/reference/examples/#nextjs-16).
