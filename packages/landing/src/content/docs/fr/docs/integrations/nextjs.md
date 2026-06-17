---
title: Next.js
description: Propagez l'en-tête de session d'enregistrement depuis les fetches côté serveur de Next.js — via middleware (recommandé) ou transfert manuel d'en-têtes — pour que les requêtes SSR soient enregistrées et rejouées.
---

Les frameworks SSR comme Next.js font des appels `fetch` côté serveur qui passent par le proxy sans contexte de navigateur. Le proxy identifie à quelle session appartiennent ces requêtes via l'en-tête `x-test-rcrd-id` — le même en-tête que `playwrightProxy.before()` définit sur la `page` du navigateur. Cet en-tête n'est **requis que pour le SSR** — pour les tests navigateur uniquement, le proxy revient automatiquement à la session définie globalement.

Pour que les requêtes SSR portent cet en-tête, utilisez l'une des options suivantes.

## Middleware (recommandé)

Next.js 16 utilise `proxy.ts` comme point d'entrée du middleware (avec la fonction exportée nommée `proxy`). Placez-le à la racine du projet, à côté de `next.config.ts` :

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

:::note[Next.js 15 et antérieur]
Le point d'entrée est `middleware.ts` avec la fonction nommée `middleware` — tout le reste est identique :

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

## Transfert manuel d'en-têtes

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

Voir la [référence de l'API](/docs/reference/api/readme/) pour les signatures complètes des helpers `test-proxy-recorder/nextjs`.

## Scripts package.json

Démarrez les services depuis des scripts, pas depuis `playwright.config.ts` :

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

Un projet complet et exécutable se trouve dans l'[exemple Next.js 16](/fr/docs/reference/examples/#nextjs-16).
