---
title: Next.js
description: Taggez les fetches côté serveur de Next.js avec l'en-tête de session d'enregistrement pour que le SSR soit enregistré et rejoué — via registerProxyFetch (recommandé, tout runtime), registerProxyAxios pour axios, ou createHeadersWithRecordingId par appel. Le middleware est optionnel.
---

Les frameworks SSR comme Next.js font des appels `fetch` côté serveur qui passent par le proxy sans contexte de navigateur. Le proxy identifie à quelle session appartiennent ces requêtes via l'en-tête `x-test-rcrd-id`. Le `playwrightProxy.before()` de Playwright le définit déjà sur la navigation navigateur qui déclenche le SSR, donc l'id est disponible dans `next/headers` — le travail consiste à **l'attacher aux requêtes sortantes côté serveur**. (Les tests navigateur uniquement n'ont besoin de rien de tout ça ; le proxy revient à la session définie globalement.)

:::tip
[`test-proxy-recorder init`](/fr/docs/getting-started/quick-start/) détecte Next.js et branche automatiquement l'approche recommandée ci-dessous dans votre root layout.
:::

:::caution[Enregistrez contre un build de production]
Enregistrez avec `next build && next start`, pas `next dev`. Le serveur de dev peut réinitialiser le patch global de `fetch` entre les requêtes ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), et est plus lent/instable. Puisque `next start` tourne en mode production, définissez `TEST_PROXY_RECORDER_ENABLED=true` sur le processus de l'app pour votre run e2e.
:::

## registerProxyFetch (recommandé)

Une ligne dans votre **root layout** tagge chaque `fetch` côté serveur — Server Components, Route Handlers, sur les runtimes Node **et** Edge :

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op en production sauf si TEST_PROXY_RECORDER_ENABLED=true
```

Il patche le `fetch` global pour copier le `x-test-rcrd-id` de la requête courante sur les requêtes sortantes, afin que le proxy puisse distinguer les sessions de replay concurrentes. Appelez-le depuis le root layout — **pas** `instrumentation.ts`, dont le contexte diffère de celui qui rend vos routes sur le runtime Edge, donc un patch là-bas ne se déclenche jamais silencieusement.

## axios — registerProxyAxios

Si vos requêtes côté serveur passent par axios, enregistrez une fois chaque instance côté serveur :

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

Il ajoute un intercepteur de requête qui pose l'id (sans jamais toucher au `fetch` global), il est donc immunisé contre la réserve du serveur de dev ci-dessus. No-op en production / dans le navigateur ; idempotent par instance ; n'écrase jamais un id défini par l'appelant.

## Par appel — createHeadersWithRecordingId

Sans patch, et fonctionne aussi sous `next dev`. À utiliser pour un fetch unique, ou quand vous préférez ne pas patcher le `fetch` global :

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (optionnel)

Un `proxy.ts` (Next.js 16+, qui exporte `proxy`) ou `middleware.ts` (15 et antérieur, qui exporte `middleware`) appelant `setNextProxyHeaders` rend l'id disponible via `next/headers`, mais **ne tagge pas les fetches sortants** — il n'est donc pas requis quand vous utilisez l'un des helpers ci-dessus. Y recourir seulement si vous possédez déjà un middleware (auth, etc.), et le coupler tout de même avec un helper pour faire le tagging :

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // expose l'id ; à coupler avec un helper ci-dessus
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Voir la [référence de l'API](/fr/docs/reference/api/readme/) pour les signatures complètes des helpers `test-proxy-recorder/nextjs`. Un projet Edge complet et exécutable se trouve dans l'[exemple Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

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
