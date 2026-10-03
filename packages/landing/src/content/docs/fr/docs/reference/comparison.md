---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js et le mode test de Next.js'
description: "Comment test-proxy-recorder se compare à MSW, routeFromHAR, Polly.js, au mode test de Next.js, à mockttp, Mocky Balboa, scenarist, talkback et proxay, sources à l'appui."
sidebar:
  label: Comparaison
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

Chaque outil présenté ici contrôle les réponses d'API que voit un test de bout en bout. Ils diffèrent par l'endroit où ils interceptent les requêtes (dans le navigateur, dans votre serveur ou dans un proxy séparé) et par le fait que vous écriviez les réponses ou que vous les enregistriez. Le tableau reprend les six outils de la [vue d'ensemble de la documentation](/fr/docs/#comparison) et ajoute le mode test de Next.js, mockttp, scenarist, talkback et proxay. Chaque cellule provient de la documentation, du README ou du code source de l'outil lui-même, liés sous le tableau, à la date du 2026-10-03. « Non documenté » signifie que ces sources ne le précisent pas.

## Tableau des fonctionnalités {#table}

| Outil | Enregistre le trafic réel | Côté serveur (SSR) | Côté navigateur | WebSocket | Natif Playwright | Dernière version |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Oui | Oui, via le proxy | Oui, via HAR | Oui | Oui | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Oui | Non | Oui | Non | Intégré | Playwright 1.63.0, 2026-09-04 |
| MSW | Non (handlers, ou un HAR via `@msw/source`) | Dans le processus serveur | Oui | Oui | `@msw/playwright`, requêtes du navigateur | 3.0.2, 2026-10-03 |
| Polly.js | Oui | Dans le processus serveur | Oui | Non documenté | Adaptateur tiers | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Oui | Non | Oui | Non documenté | Oui | 0.3.0, 2026-05-12 |
| Mocky Balboa | Non (handlers) | Oui | Oui | Non documenté | Oui | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Mode test de Next.js | Non (handlers) | Oui, Next.js uniquement | Requêtes vers d'autres origines | Non documenté | Oui | Expérimental, dans Next.js 16.3.8, 2026-09-30 |
| mockttp | Non documenté | Oui, comme proxy sortant (forward proxy) | Oui, comme proxy du navigateur | Oui | Non, une fixture à écrire soi-même | 4.6.3, 2026-09-11 |
| scenarist | Non (scénarios dans le code) | Next.js et Express | Non | Non documenté | Oui | 0.5.1, 2026-09-27 |
| talkback | Oui | Oui, comme adresse de l'API | Non documenté | Non documenté | Non | 4.2.0, 2024-07-10 |
| proxay | Oui | Oui, comme adresse de l'API | Oui, comme adresse de l'API | Non documenté | Non | npm 1.9.0, 2024-05-15 ; GitHub 2.0.0, 2026-01-29 |

## Sources et notes {#sources}

Les dates de version proviennent du registre npm, sauf quand une release GitHub est liée.

- **test-proxy-recorder.** Les appels côté serveur passent par le proxy et les appels du navigateur par HAR ([comment ça marche](/fr/docs/getting-started/how-it-works/)). Les messages WebSocket enregistrés sont rejoués par le proxy ([CLI](/fr/docs/guides/cli/#websocket-replay-pacing)). Version : [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** Avec `update: true`, il enregistre un HAR à partir du trafic réel ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). Le replay sert « the network requests that are made in the page » ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). Il passe par des handlers `route()` qui répondent aux requêtes HTTP et n'a pas de chemin pour WebSocket ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Version : [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** Vous écrivez des handlers de requêtes. MSW n'enregistre rien lui-même, mais [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) peut générer des handlers à partir d'un fichier HAR exporté depuis les DevTools du navigateur. Dans Node.js, il s'exécute dans le processus qui fait les requêtes ([`setupServer`](https://mswjs.io/guides/integrations/node)). Les WebSockets passent par l'[API `ws`](https://mswjs.io/docs/websocket). Le binding officiel [`@msw/playwright`](https://github.com/mswjs/playwright) passe par `page.route()`, il couvre donc les requêtes du navigateur. Version : [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** Son [dépôt](https://github.com/Netflix/pollyjs) le décrit comme « Record, Replay, and Stub HTTP Interactions ». L'[adaptateur node-http](https://netflix.github.io/pollyjs/#/adapters/node-http) patche les modules `http` et `https` de Node, et l'[adaptateur fetch](https://netflix.github.io/pollyjs/#/adapters/fetch) enveloppe le `fetch` global. Polly enregistre donc dans le processus qui l'exécute. Sa documentation ne liste aucun adaptateur WebSocket. La prise en charge de Playwright passe par l'adaptateur tiers [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), vers lequel renvoie la [documentation de Polly](https://netflix.github.io/pollyjs/#/adapters/playwright). Version : [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** Son [README](https://github.com/vitalets/playwright-network-cache) indique qu'il accélère les tests Playwright « by caching network requests on the filesystem ». `CacheRoute` intercepte avec `page.route()` ([source](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), il ne voit donc que les requêtes du navigateur. Version : [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** Vous définissez les mocks dans le test, pour les requêtes du serveur comme du client, via une seule API. Les mocks restent isolés par test pendant que les tests tournent en parallèle ([fonctionnalités](https://docs.mockybalboa.com/docs/features/)). Pour Next.js 14 et versions ultérieures, sa CLI démarre votre serveur Next.js ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). Sa documentation ne mentionne WebSocket que comme canal entre votre serveur et le test runner. Version : [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Mode test de Next.js.** Les handlers déclarés avec `next.onFetch()` reçoivent les appels `fetch` du serveur, ainsi que les appels `fetch` de la page vers d'autres origines ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). La page [Mock côté serveur](/fr/docs/guides/server-side-mocking/#nextjs-test-mode) couvre sa mise en place, son statut et MSW 3. Version : [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** Un serveur de mock et proxy HTTP et HTTPS pour des tests qui tournent « in node or browsers » ([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()` mocke les connexions WebSocket ([source](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). Le README ne décrit aucun mode d'enregistrement. L'[article](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) de l'équipe Playwright montre la fixture à écrire. Version : [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** Le [README](https://github.com/citypaul/scenarist) le présente comme « Built on MSW with runtime scenario management and test ID isolation », et vous écrivez les scénarios dans le code. Sa FAQ indique qu'il « provides server-side scenario management, which complements Playwright's client-side mocking ». Le code de votre serveur transmet `x-scenarist-test-id` à chaque `fetch` ([adaptateur Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), et `@scenarist/playwright-helpers` fournit la fixture Playwright. Version : [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** « A javascript HTTP proxy that records and playbacks HTTP requests » ([README](https://github.com/ijpiantanida/talkback)). Votre app envoie ses requêtes à talkback. Une requête qui correspond à une cassette (tape) sauvegardée reçoit la réponse de cette cassette, et une requête inconnue est transmise à l'hôte puis sauvegardée comme nouvelle cassette. Le README ne mentionne ni les navigateurs ni des cassettes par test. Version : [npm](https://www.npmjs.com/package/talkback).
- **proxay.** Un proxy d'enregistrement et de replay pour « a web frontend and its backend » ou « a server and another server » ([README](https://github.com/airtasker/proxay)). Les tests choisissent une cassette avec `POST /__proxay/tape`, par exemple dans `beforeEach`, et le README ne traite pas des tests en parallèle. La version 2.0.0 est une [release GitHub](https://github.com/airtasker/proxay/releases/tag/v2.0.0) ; [npm](https://www.npmjs.com/package/proxay) sert toujours la 1.9.0.

## Alternative à Polly.js pour Playwright {#pollyjs}

Polly.js, de Netflix, enregistre, rejoue et bouchonne (stub) des échanges HTTP, et a inspiré test-proxy-recorder. Son état au 2026-10-03 :

- `@pollyjs/core` n'a plus eu de version depuis la 6.0.6 du 2023-07-20. La dernière modification du dépôt, le 2025-05-31, a publié `@pollyjs/adapter-fetch` 6.0.7, qui a levé la dépréciation de l'adaptateur fetch pour Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Polly n'a pas d'adaptateur Playwright à lui. Sa documentation renvoie vers l'adaptateur tiers [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), qui s'attache à un contexte de navigateur ou à une page. Sa dernière version, la 2.4.0, date du 2024-04-18.
- Pour les appels côté serveur, Polly doit tourner dans le processus serveur, via son adaptateur node-http ou fetch.

Si vous migrez depuis Polly.js, ses concepts correspondent à ceux de test-proxy-recorder comme suit.

| Polly.js | test-proxy-recorder |
| --- | --- |
| Modes `record`, `replay` et `passthrough` ([configuration](https://netflix.github.io/pollyjs/#/configuration)) | Modes `record`, `replay` et `transparent`, définis par test par `playwrightProxy.before()` |
| Un enregistrement nommé par instance de Polly, sauvegardé par un *persister* | Un `.mock.json` (serveur) et un `.har` (navigateur) par test Playwright, dans le répertoire des enregistrements |
| Des adaptateurs dans le processus qui fait les requêtes | Un processus proxy pour les appels du serveur, HAR pour les appels du navigateur, et `registerProxyFetch()` sur le serveur |
| Requêtes mises en correspondance par défaut selon la méthode, les en-têtes, le corps, l'ordre et l'URL | Requêtes côté serveur mises en correspondance selon la méthode, le chemin et un hash de la query string, dans l'ordre d'enregistrement, sans comparer les corps. Les requêtes du navigateur suivent les règles HAR de Playwright, qui comparent aussi les corps des POST |

## MSW avec Next.js et Playwright {#msw}

Dans une app Next.js, les requêtes du navigateur et celles du serveur demandent des configurations MSW différentes.

- **Requêtes du navigateur.** [`@msw/playwright`](https://github.com/mswjs/playwright), le binding officiel, exécute vos handlers via `page.route()`, avec une fixture `network` modifiable par test.
- **Requêtes du serveur.** MSW tourne dans le processus Next.js. La documentation de MSW n'a pas de guide Next.js, et l'exemple de référence est une pull request ouverte, [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Les handlers que vous modifiez à l'exécution sont partagés par tous les tests qui atteignent ce serveur. La page [Mock côté serveur](/fr/docs/guides/server-side-mocking/#msw) donne les détails et les sources.
- **Handlers serveur par test.** Le mode test de Next.js accepte des handlers MSW par test, mais son point d'entrée MSW ne se charge pas avec MSW 3.0 ([détails](/fr/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist construit des scénarios par test sur MSW pour Next.js et Express, et le code de votre serveur transmet un en-tête d'id de test à chaque `fetch`.
- **Enregistrement.** MSW n'enregistre pas le trafic. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) transforme en handlers un fichier HAR exporté depuis les DevTools du navigateur.

test-proxy-recorder fait le compromis inverse. Il enregistre les deux côtés depuis la vraie API : il n'y a donc aucun handler à écrire. En contrepartie, vous avez moins de contrôle sur les réponses que l'API ne produit pas à la demande.

## Quand utiliser autre chose {#when-to-use-something-else}

- **Tout votre trafic est côté navigateur.** Le `routeFromHAR` intégré de Playwright ne demande aucune dépendance supplémentaire. Commencez par là, et ajoutez test-proxy-recorder quand des requêtes côté serveur apparaissent.
- **Vous voulez écrire les réponses à la main, ou forcer des erreurs et des cas limites.** Les handlers de MSW s'y prêtent mieux, et MSW tourne aussi dans [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook) et [le navigateur](https://mswjs.io/guides/integrations/browser), pas seulement dans Playwright. Pour des handlers côté serveur par test dans Playwright, regardez Mocky Balboa, scenarist ou le mode test de Next.js.
- **Il vous faut seulement un cache côté navigateur, avec peu de configuration.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) met les réponses en cache sur le disque via une seule fixture.
- **Votre serveur n'est pas écrit en JavaScript, ou vous ne pouvez pas modifier son code.** Un proxy sortant comme mockttp fonctionne via `HTTPS_PROXY`. L'[article](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) de l'équipe Playwright indique que Python, Go, Ruby, Rust et .NET fonctionnent de la même façon, et que Java a besoin de `-Dhttps.proxyHost` et `-Dhttps.proxyPort`.
- **Il vous faut l'enregistrement et le replay hors de Playwright, dans n'importe quel langage.** proxay et talkback sont des serveurs HTTP autonomes qui sauvegardent les enregistrements dans des fichiers de cassette.
