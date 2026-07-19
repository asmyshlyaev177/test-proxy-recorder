---
title: TanStack Start
description: Marquez les fetch côté serveur de TanStack Start avec l'en-tête de session d'enregistrement pour enregistrer et rejouer le SSR — via registerProxyFetch (recommandé) ou createHeadersWithRecordingId par appel.
---

TanStack Start exécute les loaders et les server functions sur le serveur, donc leurs appels `fetch` passent par le proxy sans contexte navigateur — la même situation que le [SSR de Next.js](/fr/docs/integrations/nextjs/). Le proxy identifie à quelle session appartiennent ces requêtes grâce à l'en-tête `x-test-rcrd-id`. Le `playwrightProxy.before()` de Playwright le définit déjà sur la navigation navigateur qui déclenche le SSR, donc l'id arrive sur la requête serveur entrante — le travail consiste à **l'attacher aux requêtes sortantes côté serveur**. (Les tests uniquement navigateur n'en ont pas besoin ; le proxy se rabat sur la session définie globalement.)

:::caution[Enregistrez contre un build de production]
Enregistrez avec `vite build` + `node .output/server/index.mjs` (c.-à-d. `pnpm start`), pas `vite dev`. Le contexte par-requête du serveur de développement diffère du runtime de production que `registerProxyFetch()` corrige. Comme le serveur de production tourne en mode production, définissez `TEST_PROXY_RECORDER_ENABLED=true` sur le processus de l'application pour votre exécution e2e.
:::

## registerProxyFetch (recommandé)

Une ligne dans la **configuration de votre router** marque chaque `fetch` côté serveur — loaders de route, server functions et server routes :

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // sans effet côté client / en production sauf si TEST_PROXY_RECORDER_ENABLED=true
```

Il corrige le `fetch` global pour copier le `x-test-rcrd-id` de la requête courante sur les requêtes sortantes, en le lisant depuis le contexte de requête serveur de TanStack Start (`getRequestHeader`). Placez-le en haut de `src/router.tsx` — ce module s'exécute sur le serveur pour chaque requête SSR ; l'appel est idempotent, sans effet côté client et sans effet en production sauf si l'enregistreur est explicitement activé.

## Par appel — createHeadersWithRecordingId

Sans correction (patch). À utiliser pour un seul fetch dans un loader ou une server function, ou lorsque vous préférez ne pas corriger le `fetch` global :

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

`getRecordingId()` est également exporté si vous voulez l'id brut (ou `null`) pour le transmettre vous-même. Les deux lisent l'id de la requête courante depuis le contexte serveur, et les deux sont sans effet en production sauf si `TEST_PROXY_RECORDER_ENABLED=true`.

## Pointez l'application vers le proxy

En dev/test, pointez vos URLs de base backend vers le proxy pour que **les deux** origines soient enregistrées — la base côté serveur (lue par les loaders / server functions, p. ex. `BACKEND_URL`) et la base côté navigateur intégrée au build (`VITE_API_URL`). En production, pointez-les vers le vrai backend. Les requêtes côté navigateur sont gérées par le mécanisme HAR de `playwrightProxy.before()`, exactement comme dans la [configuration manuelle](/fr/docs/getting-started/manual-setup/).

## Exemple complet

Une application complète et exécutable — construite avec **TanStack Query** (préchargement SSR + `useMutation`), couvrant les todos (navigateur + SSR), une route ISR basée sur les en-têtes de cache, un cas de rédaction (masquage) et un chat WebSocket, le tout enregistré et rejoué — se trouve dans [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Elle montre que l'enregistreur est transparent pour votre couche de données : `registerProxyFetch()` marque les fetch du `queryFn` de Query pendant le SSR, sans code spécifique à Query.
