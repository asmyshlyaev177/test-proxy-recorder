---
title: Démarrage rapide
description: Configurez test-proxy-recorder avec une seule commande init — idéalement pilotée par un agent IA. Pointez votre API vers le proxy, enregistrez une fois, rejouez en CI.
---

## Configurer avec un agent IA (recommandé)

Copiez ceci et collez-le dans votre agent de codage IA (Claude Code, Cursor, …) :

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder

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
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // adresse du proxy issue de `init`
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

Vous utilisez axios pour les appels côté serveur ? Utilisez `registerProxyAxios(instance)` à la place.
Enregistrez contre un build de production (`next build && next start`), pas `next dev`.
Les apps navigateur uniquement (SPA, extension) peuvent sauter cette étape.

### 3. Enregistrer une fois, rejouer à l'infini

```bash
# fixtures.ts: MODE = 'record' — capturer les vraies réponses
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — puis committer les enregistrements
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

La CI rejoue désormais backend éteint — les mêmes réponses à chaque fois.

---

Plus de détails : [configuration manuelle](/fr/docs/getting-started/manual-setup/) · [comment ça marche](/fr/docs/getting-started/how-it-works/) · [skills pour agents IA](/fr/docs/reference/ai-agent-skills/).
