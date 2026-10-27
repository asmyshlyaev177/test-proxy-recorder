---
title: "Configuration Playwright : enregistrer et rejouer chaque test"
description: Enregistrez et rejouez les appels d'API dans les tests Playwright avec test-proxy-recorder, grâce au hook de session before(), au teardown global recommandé et aux fichiers d'enregistrement par test.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 41506a06c67c43287c172907f5ef6c6ef07e36e3
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

**Exception — apps full-stack :** quand le navigateur appelle aussi `localhost:8100` (parce que le frontend est configuré avec l'URL du proxy comme base d'API), utilisez `/localhost:8100/` comme motif. Ces requêtes du navigateur passent alors jusqu'au proxy, qui les enregistre dans le `.mock.json` du test et les rejoue depuis celui-ci : une requête manquante reçoit donc la 404 du proxy plutôt qu'une interruption HAR (voir [la correspondance des requêtes en replay](/fr/docs/getting-started/how-it-works/#replay-matching)).

Les noms des fichiers d'enregistrement viennent du fichier de test, des titres `describe` et du titre du test (`users.spec.ts` › `create a user` → `users__create-a-user.mock.json` / `.har`). Un nom de plus de 120 octets est tronqué et se termine par un hash.

## Test sans enregistrement

En replay, `before()` lève une exception quand le test n'a pas d'enregistrement, avant de changer le mode du proxy :

```text
[test-proxy-recorder] This test has no recording: <recordingsDir>/users__create-a-user.mock.json does not exist. Record this test first.
```

Enregistrez le test plutôt que de le sauter : un test sauté est rapporté comme sauté, pas comme échoué, si bien qu'un enregistrement manquant passe inaperçu. `hasRecording(testInfo)` répond à la même question sans lever d'exception, avec les mêmes noms de fichiers que le replay.

## Teardown global (recommandé) {#global-teardown-recommended}

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

`teardown()` réinitialise le proxy à `transparent` et exécute la passe de [masquage](/fr/docs/guides/secret-redaction/) des HAR. Le passage en `transparent` sauvegarde et termine toutes les sessions d'enregistrement. Ne l'appelez pas dans un hook `afterAll` par test sous `fullyParallel` — voir la [FAQ](/fr/docs/reference/faq/#parallel-replay) pour comprendre pourquoi cela casse le replay et l'enregistrement en parallèle.

## Fichiers d'enregistrement

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
