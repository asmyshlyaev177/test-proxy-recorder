---
title: TanStack Start
description: Marquez les fetch côté serveur de TanStack Start avec l'en-tête de session d'enregistrement pour enregistrer et rejouer le SSR — via registerProxyFetch (recommandé) ou createHeadersWithRecordingId par appel.
i18nSource: docs/integrations/tanstack-start.md
i18nSourceBlob: 6367cedc46bf4ac859e573ca269e63e8d98be33a
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

## Applications authentifiées

L'enregistreur [fonctionne avec votre vrai fournisseur d'authentification](/fr/docs/getting-started/how-it-works/) (AWS Cognito, Auth0, Clerk, …), et il se combine avec le marquage SSR ci-dessus. Le principe :

- **Connectez-vous pour de vrai, en mode `transparent`.** Un projet `setup` de Playwright se connecte une seule fois avec le proxy en pass-through, donc la connexion n'est **jamais enregistrée**, et sauvegarde la session (`storageState`) que les specs authentifiées réutilisent.
- **Les requêtes protégées portent le token et sont enregistrées.** Chaque requête authentifiée envoie un en-tête `Authorization: Bearer …` ; l'enregistreur le [masque](/fr/docs/guides/secret-redaction/), donc aucun token n'atteint les enregistrements commités.
- **L'endroit où vit le token détermine le mécanisme.** Un token dans `localStorage` ne peut pas être lu côté serveur, donc le fetch protégé s'exécute dans le navigateur et est enregistré via HAR — sans préchargement SSR. Une session basée sur un cookie, en revanche, peut être transmise dans un loader avec `createHeadersWithRecordingId()` et enregistrée côté serveur.

L'application [`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) inclut un flux AWS Cognito exécutable `/login` → `/dashboard` (`e2e/setup-auth.ts` + `e2e/auth.spec.ts`) qui démontre exactement cela.

## Exemple complet

Une application complète et exécutable — construite avec **TanStack Query** (préchargement SSR + `useMutation`), couvrant les todos (navigateur + SSR), une route ISR basée sur les en-têtes de cache, un cas de masquage, un chat WebSocket et une vraie connexion AWS Cognito (authentification en mode transparent + une API protégée enregistrée avec token masqué), le tout enregistré et rejoué — se trouve dans [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Elle montre que l'enregistreur est transparent pour votre couche de données : `registerProxyFetch()` marque les fetch du `queryFn` de Query pendant le SSR, sans code spécifique à Query.
