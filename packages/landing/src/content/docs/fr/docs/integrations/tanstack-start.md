---
title: TanStack Start
description: Une intégration de première classe pour TanStack Start est sur la feuille de route. En attendant, propagez l'en-tête de session d'enregistrement à la main depuis les server functions.
---

:::caution[Sur la feuille de route]
Un adaptateur `test-proxy-recorder/tanstack-start` de première classe est prévu mais pas encore publié. Cette page décrit le modèle manuel qui fonctionne aujourd'hui, et sera remplacée par le guide dédié quand l'adaptateur arrivera. Vous le voulez plus tôt ? [Ouvrez une issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

TanStack Start exécute les loaders et les server functions sur le serveur, donc leurs appels `fetch` passent par le proxy sans contexte de navigateur — la même situation que le [SSR de Next.js](/fr/docs/integrations/nextjs/). Le proxy a besoin de l'en-tête `x-test-rcrd-id` sur ces requêtes côté serveur pour les attribuer à la bonne session d'enregistrement.

## Modèle manuel (fonctionne aujourd'hui)

L'en-tête que `playwrightProxy.before()` définit sur la `page` du navigateur arrive dans la requête entrante côté serveur. Lisez-le là et transmettez-le sur tout `fetch` côté serveur :

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

Pointez l'URL de base de votre backend vers le proxy (`http://localhost:8100`) en dev/test uniquement, exactement comme dans la [configuration manuelle](/fr/docs/getting-started/manual-setup/). Les requêtes côté navigateur restent gérées par le mécanisme HAR de `playwrightProxy.before()`.

Quand l'adaptateur arrivera, cela se réduira à un seul import de helper — suivez l'avancement sur la [feuille de route](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
