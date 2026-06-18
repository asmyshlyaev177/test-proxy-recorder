---
title: Démarrage rapide
description: Une seule commande init scaffolde test-proxy-recorder — middleware SSR Next.js inclus. Pointez votre API vers le proxy, enregistrez une fois, rejouez en CI.
---

## 1. Scaffolder

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

Ceci écrit tout sans rien écraser :

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # Next.js uniquement — middleware SSR
e2e/fixtures.ts          # enregistrement vs replay
e2e/global-teardown.ts
package.json             # + scripts proxy / test:e2e
```

## 2. Pointer l'API de votre app vers le proxy

La seule chose que `init` ne peut pas deviner : quelle variable d'environnement contient l'URL de base de votre API. Pointez-la vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production :

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // adresse du proxy issue de `init`
```

## 3. Enregistrer une fois, rejouer à l'infini

```bash
# fixtures.ts: MODE = 'record' — capturer les vraies réponses
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — puis committer les enregistrements
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

La CI rejoue désormais backend éteint — les mêmes réponses à chaque fois.

---

Vous branchez le tout à la main, ou vous voulez les détails ? Voir [configuration manuelle](/fr/docs/getting-started/manual-setup/) et [comment ça marche](/fr/docs/getting-started/how-it-works/).
