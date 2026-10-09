---
title: "Comment fonctionnent l'enregistrement et le replay : un proxy pour le SSR, HAR pour le navigateur"
description: test-proxy-recorder enregistre le trafic via deux mécanismes, un proxy pour les requêtes côté serveur et HAR pour les requêtes côté navigateur, utilisés ensemble ou séparément.
sidebar:
  label: Comment ça marche
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 32bdd456b9abbf2556d3314806353dd2cc86c971
---

test-proxy-recorder prend en charge deux mécanismes d'enregistrement selon l'origine de vos requêtes. Les deux peuvent être utilisés ensemble ou indépendamment.

| Mécanisme | Ce qu'il enregistre | Cas d'usage |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Requêtes côté serveur (fetches SSR de Next.js, etc.) | Apps full-stack où le serveur appelle l'API |
| **HAR** (`.har`) | Requêtes côté navigateur (`fetch` du navigateur, extensions, SPA) | SPA, extensions Chrome, API tierces |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Chaque test définit le mode à son démarrage, et le proxy garde un seul mode pour toutes les requêtes qu'il reçoit : les tests qui tournent en même temps le partagent donc. En mode **record**, le proxy transmet au vrai backend et sauvegarde les réponses ; en mode **replay**, il sert les réponses sauvegardées depuis le disque, et l'id de chaque test sélectionne l'enregistrement de ce test ; en mode **transparent**, il transmet sans enregistrer. Le proxy démarre en mode transparent, donc une app qui passe par lui en dehors des tests parle à son backend comme d'habitude. Voir l'[endpoint de contrôle](/fr/docs/guides/control-endpoint/) pour savoir comment les modes sont changés.

## Correspondance des requêtes en replay {#replay-matching}

Le proxy et le fichier HAR retrouvent une réponse enregistrée de façons différentes.

| En replay | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Critères de correspondance | La méthode, le chemin et un hash MD5 de la query string. Le corps n'est pas comparé. | La méthode et l'URL, plus le corps pour un `POST` ([règles de Playwright](https://playwright.dev/docs/mock#replaying-from-har)). |
| Même requête répétée | L'enregistrement suivant, dans l'ordre d'enregistrement. | L'entrée qui a le plus d'en-têtes correspondants. L'ordre d'enregistrement est ignoré. |
| Aucun enregistrement | Une réponse 404 avec un corps JSON qui nomme la requête, et `playwrightProxy.before()` ferme la page pour que le test échoue aussitôt (`failOnMissingRecording: false` désactive ce comportement). | La requête est interrompue. |
| Vraie API atteinte | Uniquement en mode `transparent`. | Uniquement par les requêtes qui ne correspondent pas à `url`. |

### Requêtes côté serveur (proxy)

La clé est formée de la méthode, du chemin et des 16 premiers caractères hexadécimaux du hash MD5 de la query string. `GET /todos?page=2` a pour clé `GET_todos_46589c7afd19c014.json` : une query string qui diffère si peu que ce soit, même par l'ordre des paramètres, donne donc une autre clé.

Les appels qui ont la même clé sont servis dans l'ordre où ils ont été enregistrés. Un appel au-delà du dernier enregistrement reçoit de nouveau la dernière réponse, et le proxy journalise `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`.

Une requête sans enregistrement n'atteint pas la vraie API. Le proxy journalise des lignes `[REPLAY ERROR]` et répond par une 404 :

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

Le proxy n'envoie les requêtes au vrai backend qu'en mode `transparent`. Une exécution en replay bascule dans ce mode de deux façons : `playwrightProxy.teardown()` s'exécute alors que des tests tournent encore, ou le timeout de session (120000 ms par défaut) expire avant l'appel suivant à `playwrightProxy.before()`. La [FAQ](/fr/docs/reference/faq/#parallel-replay) explique les deux cas.

### Requêtes du navigateur (HAR)

Quand vous passez `url`, `playwrightProxy.before()` confie les requêtes du navigateur au routage HAR de Playwright :

```typescript
await page.routeFromHAR(harPath, { url, update: mode === 'record', updateContent: 'embed' });
```

L'option `notFound` de Playwright vaut `'abort'` par défaut : en replay, une requête qui correspond à `url` mais qui n'est pas dans le `.har` est donc interrompue. Les requêtes qui ne correspondent pas à `url` ne sont pas interceptées. Elles partent sur le vrai réseau, en enregistrement comme en replay.

Les requêtes vers le proxy lui-même (`localhost:8100`) font exception. `before()` ajoute pour elles son propre handler après celui du HAR, et Playwright exécute d'abord le handler ajouté en dernier. Ce handler les transmet au proxy, qui les rejoue depuis le `.mock.json` comme les requêtes côté serveur.
