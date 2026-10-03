---
title: FAQ
description: Questions fréquentes sur test-proxy-recorder — replay en parallèle, commit des enregistrements dans git, la cible du proxy pour l'enregistrement HAR, le serveur de dev Next.js et la mise à jour des enregistrements.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 59a850f40bf95a3cbc42808fac8a58ee42a6465a
---

## Mes tests de replay en parallèle appellent parfois le vrai backend — pourquoi ? {#parallel-replay}

Vous appelez probablement `playwrightProxy.teardown()` dans un hook par test. Il met le mode **global** du proxy à `transparent`, et avec `fullyParallel: true`, chaque worker Playwright exécute son propre `test.afterAll`. Si un test rapide se termine et appelle `teardown()` pendant qu'un test plus lent tourne encore, le proxy bascule en transparent en plein test et les requêtes restantes sont transmises au vrai backend au lieu d'être rejouées.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Solution :** omettez `test.afterAll`. Le nettoyage de session est automatique via `context.on('close')` → `cleanupSession()`. N'utilisez un [global teardown](https://playwright.dev/docs/test-global-setup-teardown) que si vous devez réinitialiser le proxy après toute l'exécution.

Le timeout de session est l'autre façon dont une exécution en replay atteint le vrai backend. Chaque appel à `playwrightProxy.before()` le relance ; les requêtes qui passent par le proxy ne le relancent pas. S'il expire (120000 ms par défaut) avant l'appel suivant à `before()`, le proxy passe en `transparent`. Un test encore en cours envoie alors ses requêtes restantes au vrai backend. Si un test peut durer aussi longtemps, augmentez le timeout avec `--timeout` en [CLI](/fr/docs/guides/cli/) ou `timeout` dans la [configuration](/fr/docs/guides/config/).

## Puis-je enregistrer avec des workers en parallèle ? {#parallel-recording}

Non. Le proxy ne tient qu'une session d'enregistrement à la fois. Quand un deuxième test commence à enregistrer, le proxy sauvegarde le fichier du premier test et passe au deuxième. Les requêtes restantes du premier test qui passent par le proxy finissent alors dans le `.mock.json` du deuxième. Enregistrez avec un seul worker, comme le fait déjà le script `test:e2e:record` qu'ajoute `init` :

```bash
npx playwright test --workers 1
```

Le replay, lui, peut tourner avec des workers en parallèle. Chaque test rejoue sa propre session, et l'en-tête `x-test-rcrd-id` permet de les distinguer : `playwrightProxy.before()` le pose sur les requêtes de la page, et `registerProxyFetch()` le recopie sur celles côté serveur. C'est pour cette raison que les [apps d'exemple](/fr/docs/reference/examples/) enregistrent avec `--workers 1`.

## Dois-je committer les enregistrements dans git ?

Oui. Les enregistrements doivent être dans git pour que la CI puisse les rejouer sans réseau — n'ajoutez **pas** `e2e/recordings` à `.gitignore`. Pour éviter que les gros fichiers d'enregistrement n'encombrent les revues de PR, marquez-les comme générés dans `.gitattributes` : GitHub replie leurs diffs par défaut et les affiche toujours en un clic, de sorte qu'un champ renommé par l'API reste visible en revue. Les marquer `binary` cacherait complètement ce changement.

```text
/e2e/recordings/** linguist-generated=true
```

## La `<target-url>` du proxy importe-t-elle pour l'enregistrement navigateur uniquement (HAR) ?

Non. Pour l'enregistrement navigateur uniquement, la cible n'a pas d'importance — le processus du proxy doit seulement tourner pour que son endpoint `/__control` soit disponible pour la gestion des sessions. La cible n'importe que lorsque des requêtes côté serveur (SSR) sont aussi routées via le proxy.

## Que deviennent les requêtes du navigateur hors du motif `url` ? {#outside-url}

Playwright ne les intercepte pas : elles partent donc sur le vrai réseau, en enregistrement comme en replay. Rien n'est sauvegardé pour elles. Les requêtes vers le proxy (`localhost:8100`) font exception. `playwrightProxy.before()` les transmet toujours au proxy, qui les enregistre et les rejoue lui-même.

Pour garder un test hors du réseau, élargissez `url` pour que le HAR couvre le domaine, ou bloquez le domaine avec `page.route()` et `route.abort()` :

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  // Le HAR enregistre et rejoue aussi le CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Les appels d'analytics échouent au lieu d'atteindre le réseau.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

La section [Correspondance des requêtes en replay](/fr/docs/getting-started/how-it-works/#replay-matching) donne les détails.

## Puis-je enregistrer contre le serveur de dev Next.js ?

Préférez `next build` + `next start` à `next dev` pour enregistrer et rejouer. Le serveur de dev est lent et peut provoquer des timeouts ou des enregistrements instables.

## Comment mettre à jour un enregistrement ?

Relancez en mode record (mettez `MODE = 'record'` dans votre fixture, ou `RECORD_MODE=1`) contre la vraie API, puis repassez en replay et committez les fichiers mis à jour dans `e2e/recordings/`.

## Puis-je forcer une erreur, une liste vide ou une réponse lente dans un test rejoué ? {#override-responses}

Oui, pour les requêtes du navigateur. Playwright exécute les handlers de route [dans l'ordre inverse de leur ajout](https://playwright.dev/docs/api/class-route#route-fallback) : un `page.route()` ajouté après `playwrightProxy.before()` voit donc chaque requête en premier. Il peut répondre lui-même à la requête, ou appeler `route.fallback()` pour la passer aux enregistrements.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Ajouté après before() : Playwright exécute donc ce handler en premier.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // toute autre requête est rejouée telle qu'enregistrée
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

Pour une liste vide, répondez plutôt avec `json: []`. Pour une réponse lente, attendez avant d'appeler `route.fallback()`, par exemple avec `await new Promise((resolve) => setTimeout(resolve, 3000))`. La réponse enregistrée arrive alors avec trois secondes de retard.

Les requêtes côté serveur ne passent jamais par le navigateur, donc `page.route()` ne peut pas les modifier. Pour celles-ci, modifiez l'enregistrement dans le `.mock.json` à la main, ou enregistrez contre une API qui se trouve dans l'état voulu. Dans le fichier, la `response` de chaque enregistrement contient `statusCode`, `headers` et `body`. Si vous changez la longueur du corps, supprimez aussi l'en-tête `content-length`.

## Puis-je l'utiliser quand la suite teste un environnement déployé ? {#deployed-environment}

Oui, pour les requêtes du navigateur. Playwright les intercepte dans le navigateur, donc le HAR les enregistre et les rejoue sans aucun changement dans l'app déployée. Pointez `url` vers le domaine d'API qu'appelle le navigateur. Le proxy doit quand même tourner à côté des tests, car `playwrightProxy.before()` définit le mode de chaque test via son endpoint `/__control`.

Les requêtes côté serveur sont faites par le serveur de l'app : un proxy en CI ne voit donc jamais celles d'un serveur déployé. Pour les enregistrer ou les rejouer, lancez le serveur de l'app en CI à côté du proxy. Pour l'exécution des tests, faites-en un build et démarrez-le avec son URL de base d'API pointée vers le proxy et `TEST_PROXY_RECORDER_ENABLED=true` défini. Les pages [Next.js](/fr/docs/integrations/nextjs/) et [TanStack Start](/fr/docs/integrations/tanstack-start/) montrent cette configuration.
