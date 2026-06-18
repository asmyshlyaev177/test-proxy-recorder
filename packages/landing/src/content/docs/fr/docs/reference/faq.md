---
title: FAQ
description: Questions fréquentes sur test-proxy-recorder — replay en parallèle, commit des enregistrements dans git, la cible du proxy pour l'enregistrement HAR, le serveur de dev Next.js et la mise à jour des enregistrements.
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

## Dois-je committer les enregistrements dans git ?

Oui. Les enregistrements doivent être dans git pour que la CI puisse les rejouer sans réseau — n'ajoutez **pas** `e2e/recordings` à `.gitignore`. Pour éviter que les gros fichiers d'enregistrement ne gonflent les diffs de PR, marquez-les comme binaires dans `.gitattributes` :

```text
/e2e/recordings/** binary
```

## La `<target-url>` du proxy importe-t-elle pour l'enregistrement navigateur uniquement (HAR) ?

Non. Pour l'enregistrement navigateur uniquement, la cible n'a pas d'importance — le processus du proxy doit seulement tourner pour que son endpoint `/__control` soit disponible pour la gestion des sessions. La cible n'importe que lorsque des requêtes côté serveur (SSR) sont aussi routées via le proxy.

## Puis-je enregistrer contre le serveur de dev Next.js ?

Préférez `next build` + `next start` à `next dev` pour enregistrer et rejouer. Le serveur de dev est lent et peut provoquer des timeouts ou des enregistrements instables.

## Comment mettre à jour un enregistrement ?

Relancez en mode record (mettez `MODE = 'record'` dans votre fixture, ou `RECORD_MODE=1`) contre la vraie API, puis repassez en replay et committez les fichiers mis à jour dans `e2e/recordings/`.
