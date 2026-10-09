---
title: Démarrage rapide
description: Configurez test-proxy-recorder avec une seule commande init — idéalement pilotée par un agent IA. Pointez votre API vers le proxy, enregistrez une fois, rejouez en CI.
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 2069e312fd2960771c4b3d1a68714cae12c23410
---

## Configurer avec un agent IA (recommandé)

Copiez ceci et collez-le dans votre agent de codage IA (Claude Code, Cursor, …) :

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

L'agent ajoute les skills, scaffolde tout avec `init` (config, fixture Playwright, teardown, scripts, et — sur Next.js — `registerProxyFetch()` dans votre root layout), puis termine le branchement que `init` ne peut pas deviner depuis le prompt que `init` affiche. Vous voulez un setup fini à copier ? Voir les [exemples](/fr/docs/reference/examples/).

## Ou branchez le tout à la main

`init` écrit tout sans rien écraser :

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # Next.js uniquement — ajoute registerProxyFetch() pour tagger les fetches SSR
e2e/fixtures.ts          # enregistrement vs replay
e2e/global-teardown.ts
package.json             # + scripts proxy / test:e2e
```

### 1. Pointez l'API de votre app vers le proxy

La seule chose que `init` ne peut pas deviner : quelle variable d'environnement contient l'URL de base de votre API. Pointez-la vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production :

```ts
// TEST_PROXY_RECORDER_ENABLED vaut 'true' ou '1' uniquement pendant l'exécution e2e.
const recorderEnv = process.env.TEST_PROXY_RECORDER_ENABLED ?? '';
const API_BASE = ['true', '1'].includes(recorderEnv)
  ? 'http://localhost:8100' // adresse du proxy issue de `init`
  : 'https://api.example.com';
```

### 2. Tagger les fetches côté serveur (Next.js uniquement)

Les requêtes navigateur portent déjà l'id de session d'enregistrement (Playwright le définit). Pour les fetches côté serveur (SSR, Server Components), ajoutez une ligne à votre root layout pour qu'ils soient aussi taggés — `init` le fait pour vous :

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op en production sauf si TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Vous utilisez axios pour les appels côté serveur ? Utilisez `registerProxyAxios(instance)` à la place. Enregistrez contre un build de production (`next build && next start`), pas `next dev`. Les apps navigateur uniquement (SPA, extension) peuvent sauter cette étape.

### 3. Enregistrer une fois, rejouer à l'infini

Les tests utilisent votre backend de développement et sa base de données. Les scripts `test:e2e` testent un build de production de l'app lorsque `init` en a trouvé un (un script `preview`, ou `start` de Next.js), et un simple `npx playwright test` ou `--ui` utilise votre serveur de développement, ce qui vous permet de relancer à la main un test en échec et de reproduire le bug dans le navigateur. Avant d'enregistrer, lancez `dev` et mettez la base de données de développement dans l'état attendu par les tests avec votre propre script de peuplement (seed).

```bash
# Définit RECORD_MODE=1 — capturer les vraies réponses
npm run test:e2e:record

# Puis committer les enregistrements, que npm run test:e2e rejoue
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

La CI rejoue désormais backend éteint — les mêmes réponses à chaque fois.

---

Plus de détails : [configuration manuelle](/fr/docs/getting-started/manual-setup/) · [comment ça marche](/fr/docs/getting-started/how-it-works/) · [skills pour agents IA](/fr/docs/reference/ai-agent-skills/).
