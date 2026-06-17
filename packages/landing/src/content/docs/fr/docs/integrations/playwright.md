---
title: Playwright
description: Utilisez test-proxy-recorder depuis les tests Playwright — le hook de session before(), le teardown global recommandé et l'emplacement des fichiers d'enregistrement.
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

Appelez ceci au début de chaque test (ou dans un `beforeEach` / une fixture de page). Il définit le mode du proxy pour la session et, si `url` est fourni, configure l'enregistrement HAR pour les requêtes côté navigateur.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**Motif `url` :** correspond au vrai domaine externe que le navigateur appelle. En mode record, les requêtes vont à la vraie API et sont sauvegardées dans un fichier `.har`. En mode replay, elles sont servies depuis ce fichier — sans réseau. Ce motif ne pointe **pas** vers le proxy (`localhost:8100`).

**Exception — apps full-stack :** quand le navigateur appelle aussi `localhost:8100` (parce que le frontend est configuré avec l'URL du proxy comme base d'API), utilisez `/localhost:8100/` comme motif.

Les noms de fichiers d'enregistrement sont dérivés des noms de tests (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Teardown global (recommandé)

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` réinitialise le proxy à `transparent` et exécute la passe de [rédaction](/fr/docs/guides/secret-redaction/) des HAR. Ne l'appelez pas dans un hook `afterAll` par test sous `fullyParallel` — voir la [FAQ](/fr/docs/reference/faq/#parallel-replay) pour comprendre pourquoi cela casse le replay en parallèle.

## Fichiers d'enregistrement

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
