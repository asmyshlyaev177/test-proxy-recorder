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

## Mise en cache et ISR

Ne désactivez pas la mise en cache pour les tests — le recorder fonctionne avec une route mise en cache/ISR. Mais une règle décide de toute la conception : **pour rejouer un fetch SSR, la page doit exécuter ce fetch au moment de la requête.** Une route qui sert du HTML prérendu ou un rendu mis en cache obsolète ne fait jamais le fetch, donc le proxy n'a rien à servir et l'assertion voit du contenu obsolète.

La façon qui reste déterministe est de mettre en cache le fetch SSR avec `next.revalidate` + `next.tags` au niveau du fetch, puis d'invalider à la demande avant l'assertion :

```tsx
// app/isr/page.tsx — pas de `export const dynamic`, pas de `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // Next.js 16 exige le 2e argument de profil
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // purge dure
await page.goto('/isr');                     // une seule navigation — déterministe
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

`revalidateTag` sur une entrée de cache de **fetch** est une *purge dure* : la lecture suivante est un cache miss qui bloque et refait le fetch à travers le proxy. Vous devez purger avant la navigation de replay car le cache de données survit entre les phases enregistrement → replay d'un même processus `next start` — sinon le replay sert le cache de la phase d'enregistrement et n'atteint jamais le proxy (un faux positif).

Pendant les tests, le `fetch` patché lit `headers()`, donc la page est rendue dynamiquement et exécute réellement le fetch. En production (recorder désactivé), rien ne lit `headers()` et la page est en ISR statique comme d'habitude — le rendu dynamique est limité aux tests, et il est intrinsèque à l'enregistrement d'un fetch SSR.

:::caution[Évitez `unstable_cache` pour ça]
`unstable_cache` est *stale-while-revalidate* : `revalidateTag` marque son entrée comme obsolète, la lecture suivante renvoie la valeur obsolète et régénère en **arrière-plan**, donc la valeur fraîche arrive après votre assertion — instable, même sur une page `force-dynamic` et même avec une requête de préchauffage. Utilisez `next.tags` au niveau du fetch (une purge dure) à la place.
:::

La revalidation à la demande est privilégiée (elle purge le cache et force une régénération), donc protégez la route avec un secret partagé — échouez en mode fermé s'il n'est pas défini, comparez en temps constant, et attachez le token depuis le test via `use.extraHTTPHeaders` de Playwright pour que le spec ne le manipule jamais.

Voir l'exemple complet et exécutable (partie de l'[exemple Next.js 16](/fr/docs/reference/examples/#nextjs-16)) :

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — la page mise en cache (`next.tags` au niveau du fetch)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — comment protéger `revalidateTag` : échec en mode fermé + comparaison du secret en temps constant
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — invalide, puis une seule navigation ; vérifie que l'appel de revalidation a réussi
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — charge `.env` et attache le secret via `extraHTTPHeaders`

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
