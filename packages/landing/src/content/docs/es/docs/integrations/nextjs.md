---
title: Next.js
description: Propaga la cabecera de sesión de grabación desde los fetches del lado del servidor de Next.js — vía middleware (recomendado) o reenvío manual de cabeceras — para que las peticiones SSR se graben y reproduzcan.
---

Los frameworks SSR como Next.js hacen llamadas `fetch` del lado del servidor que pasan por el proxy sin un contexto de navegador. El proxy identifica a qué sesión pertenecen esas peticiones mediante la cabecera `x-test-rcrd-id` — la misma cabecera que `playwrightProxy.before()` establece en la `page` del navegador. Esta cabecera **solo es necesaria para SSR** — para pruebas solo de navegador el proxy recurre automáticamente a la sesión establecida globalmente.

Para que las peticiones SSR lleven esta cabecera, usa una de las siguientes opciones.

## Middleware (recomendado)

Next.js 16 usa `proxy.ts` como punto de entrada del middleware (con la función exportada llamada `proxy`). Colócalo en la raíz del proyecto junto a `next.config.ts`:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

:::note[Next.js 15 y anteriores]
El punto de entrada es `middleware.ts` con la función llamada `middleware` — todo lo demás es idéntico:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}
```
:::

## Reenvío manual de cabeceras

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

Mira la [referencia de la API](/docs/reference/api/readme/) para las firmas completas de los ayudantes de `test-proxy-recorder/nextjs`.

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
