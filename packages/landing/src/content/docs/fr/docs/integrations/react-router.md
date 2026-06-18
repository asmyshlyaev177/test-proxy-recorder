---
title: React Router / Remix
description: Une intégration de première classe pour React Router 7 (framework mode) et Remix est sur la feuille de route. En attendant, transmettez l'en-tête de session d'enregistrement à la main depuis les loaders et actions.
---

:::caution[Sur la feuille de route]
Un adaptateur de première classe pour React Router 7 framework mode (ce que « Remix » signifie en pratique aujourd'hui) est prévu mais pas encore publié. Cette page décrit le modèle manuel qui fonctionne aujourd'hui, et sera remplacée par le guide dédié quand l'adaptateur arrivera. Vous le voulez plus tôt ? [Ouvrez une issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

Les loaders et actions de React Router 7 s'exécutent sur le serveur, donc leurs appels `fetch` passent par le proxy sans contexte de navigateur — la même situation que le [SSR de Next.js](/fr/docs/integrations/nextjs/). Le proxy a besoin de l'en-tête `x-test-rcrd-id` sur ces requêtes côté serveur pour les attribuer à la bonne session d'enregistrement.

## Modèle manuel (fonctionne aujourd'hui)

Chaque loader/action reçoit la `request` entrante. Lisez l'en-tête de l'id d'enregistrement dessus et transmettez-le sur tout `fetch` côté serveur :

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Pointez l'URL de base de votre backend vers le proxy (`http://localhost:8100`) en dev/test uniquement, exactement comme dans la [configuration manuelle](/fr/docs/getting-started/manual-setup/). Les requêtes côté navigateur restent gérées par le mécanisme HAR de `playwrightProxy.before()`.

Quand l'adaptateur arrivera, cela se réduira à un seul import de helper — suivez l'avancement sur la [feuille de route](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
