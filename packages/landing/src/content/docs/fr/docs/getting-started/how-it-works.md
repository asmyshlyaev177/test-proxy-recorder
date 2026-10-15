---
title: "Comment fonctionnent l'enregistrement et le replay : un proxy pour le SSR, HAR pour le navigateur"
description: test-proxy-recorder enregistre le trafic via deux mécanismes, un proxy pour les requêtes côté serveur et HAR pour les requêtes côté navigateur, utilisés ensemble ou séparément.
sidebar:
  label: Comment ça marche
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 26b907ff9c82df698a55827441e0b4b432a42262
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
| Critères de correspondance | La méthode, le chemin et un hash MD5 de la query string. Le corps n'est pas comparé. | La méthode, l'URL et le corps, puis les entrées qui partagent le plus d'en-têtes de requête, puisqu'une même URL et un même corps peuvent être des opérations différentes, distinguées par un en-tête. Si aucune entrée n'a ce corps, la correspondance se rabat sur la méthode et l'URL, et le délimiteur (boundary) multipart est ignoré. |
| Même requête répétée | L'enregistrement suivant, dans l'ordre d'enregistrement. | L'enregistrement suivant, dans l'ordre d'enregistrement, avec une règle pour les écritures (voir plus bas). |
| Aucun enregistrement | Une réponse 404 avec un corps JSON qui nomme la requête, et `playwrightProxy.before()` ferme la page pour que le test échoue aussitôt (`failOnMissingRecording: false` désactive ce comportement). | La requête est interrompue et `[Client-Side Replay] No recorded response for <method> <url>` est écrit dans les logs. |
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

Quand vous passez `url`, `playwrightProxy.before()` enregistre les requêtes du navigateur correspondantes avec l'enregistreur HAR de Playwright :

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

Le replay est assuré par un handler `page.route()` propre à la bibliothèque, qui lit ce fichier, et non par `page.routeFromHAR()`. Le replay de Playwright sert à chaque répétition d'une requête la première entrée correspondante ([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), si bien qu'un `GET` après un `POST` affichait la liste d'avant le `POST`. Le handler sert au contraire chaque enregistrement une seule fois, dans l'ordre d'enregistrement, et n'en réutilise un que lorsque la page demande plus souvent que pendant l'enregistrement. Une règle ordonne les lectures par rapport aux écritures. Une fois qu'une écriture sur un chemin (toute méthode autre que `GET`, `HEAD` et `OPTIONS`, si bien qu'une query GraphQL compte) a été rejouée, une lecture de ce chemin ou d'un chemin situé en dessous privilégie les copies enregistrées après l'écriture. Une lecture à laquelle il ne reste aucune copie avant l'écriture suivante de ce type réutilise la plus récente qui précède cette écriture. Cette règle garde le replay correct quand l'application lit un nombre de fois différent de celui de l'enregistrement, par exemple avec un double fetch en mode strict de React. Une redirection enregistrée est suivie à l'intérieur du `.har`, car la requête suivante du navigateur n'atteint jamais `page.route()` : un fetch reçoit la réponse finale, et une navigation est envoyée vers la cible de la redirection.

Une requête qui correspond à `url` mais qui n'est pas dans le `.har` est interrompue. Les requêtes qui ne correspondent pas à `url` ne sont pas interceptées, et en mode `transparent` aucune ne l'est. Elles partent sur le vrai réseau.

Les requêtes vers le proxy lui-même (`localhost:8100`) font exception. `before()` ajoute pour elles son propre handler après celui du HAR, et Playwright exécute d'abord le handler ajouté en dernier. Ce handler les transmet au proxy, qui les rejoue depuis le `.mock.json` comme les requêtes côté serveur.
