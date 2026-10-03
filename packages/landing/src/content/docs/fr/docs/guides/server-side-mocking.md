---
title: 'Mocker les requêtes côté serveur dans Playwright (Next.js, TanStack Start)'
description: 'Pourquoi page.route() ne voit pas les fetches côté serveur de Next.js et TanStack Start, et comment le mode test, MSW, mockttp ou des réponses enregistrées les prennent en charge dans Playwright.'
sidebar:
  label: Mock côté serveur
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: f5b4c780da98c479c1bc9c0491d2ae9747da5b85
---

Dans une app Next.js ou TanStack Start, le serveur appelle votre API pendant qu'il rend une page. Le mock de requêtes de Playwright ne voit jamais ces appels. Les sections ci-dessous expliquent pourquoi, puis comparent quatre façons de les contrôler dans un test Playwright : le mode test de Next.js, MSW dans le serveur, un proxy sortant (forward proxy) comme mockttp, et l'enregistrement de vraies réponses avec test-proxy-recorder. Les faits concernant les autres outils ont été vérifiés dans leur propre documentation et leur code source le 2026-10-03.

## Pourquoi `page.route()` ne voit pas les requêtes côté serveur {#why}

La méthode [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) de Playwright agit sur les « network requests that are made by a page ». Un Server Component, un loader de route ou une server function s'exécute au contraire dans le processus Node.js de votre app. Son `fetch` part de ce processus directement vers l'API. La requête ne passe jamais par le navigateur, donc Playwright n'a rien à intercepter. `page.route()` voit bien la requête de page que le navigateur envoie à votre app, et le HTML qui revient. Il ne voit jamais les requêtes que le serveur a faites pour construire ce HTML.

Les fichiers HAR ont la même limite, car [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) sert « the network requests that are made in the page ».

La [comparaison de MSW avec Playwright](https://mswjs.io/docs/comparison#playwright) dit la même chose : `page.route()` agit sur « the traffic in the spawned browser, not the Node.js process ». L'[article de l'équipe Playwright sur le mock côté serveur](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) indique que `page.route()` fonctionne pour les requêtes du navigateur, puis : « For server-side HTTP calls, it doesn't. » La demande de fonctionnalité pour un mock côté serveur intégré, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), a été fermée le 2026-05-22 avec un lien vers cet article.

## Mode test de Next.js {#nextjs-test-mode}

Next.js fournit une intégration Playwright expérimentale dans `next/experimental/testmode/playwright`. Sa seule documentation est un [README dans le dépôt Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), et le [guide Playwright de Next.js](https://nextjs.org/docs/app/guides/testing/playwright) ne la mentionne pas. Un test déclare des handlers avec `next.onFetch()`, et Next.js leur envoie les appels `fetch` du serveur :

```typescript
// Version raccourcie de l'exemple du README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

Ce qu'il faut :

- `experimental: { testProxy: true }` dans `next.config.js`.
- Un `playwright.config.ts` construit avec le `defineConfig` de `next/experimental/testmode/playwright`, et des tests qui importent `test` depuis le même module.

En coulisses, chaque worker Playwright démarre un petit serveur proxy. La fixture ajoute aux requêtes de la page un en-tête `Next-Test-Proxy-Port` (ce proxy) et un en-tête `Next-Test-Data` (l'id du test) ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). Avec `testProxy` activé, le serveur lit ces en-têtes et envoie chaque `fetch` côté serveur à ce proxy. Le proxy transmet la requête aux handlers de ce test ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Les handlers sont conservés par id de test, donc des tests en parallèle peuvent partager un même serveur Next.js. Un fetch serveur auquel aucun handler ne répond lève `Proxy request aborted`. Un handler peut à la place renvoyer `'continue'` pour laisser passer une requête. `next.onFetch()` reçoit aussi les propres appels `fetch` de la page vers d'autres origines.

Statut :

- Expérimental. Le chemin d'import et la clé de configuration le disent tous les deux, et le README s'intitule « Experimental test mode for Playwright ».
- Il reçoit encore des correctifs. Le plus récent, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), a été fusionné le 2026-08-13.
- Le README propose aussi des handlers MSW par test via `next/experimental/testmode/playwright/msw`. Avec MSW 3.0 (publié le 2026-09-28), ce point d'entrée ne se charge pas. Il importe `strict-event-emitter`, dont MSW 3.0 ne dépend plus. Il appelle aussi `handleRequest()` de MSW, que la 3.0 a supprimé ([notes de version de MSW 3.0](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). Il se charge avec MSW 2.15.0. Les deux résultats ont été obtenus avec Next.js 16.3.8, le 2026-10-03.

## MSW dans le serveur Next.js {#msw}

MSW intercepte les requêtes dans Node.js avec `setupServer` de `msw/node` ([intégration Node.js](https://mswjs.io/guides/integrations/node)). Sa documentation n'a pas de guide Next.js. Quand l'auteur de MSW a fermé l'issue sur l'App Router, il a désigné [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) comme référence d'intégration ([commentaire](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). Cette pull request est ouverte depuis le 2024-01-22. Elle démarre l'intercepteur depuis le root layout, avec une liste fixe de handlers :

```tsx
// app/layout.tsx, tiré de mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

Les handlers vivent alors dans le processus Next.js. L'exemple démarre ce processus avec le `webServer` de Playwright, qui lance un seul processus pour toute l'exécution ([article de l'équipe Playwright](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Chaque worker envoie ses pages à cet unique serveur, et des workers en parallèle changent le comportement de ses handlers :

- Un test ne peut pas appeler `server.use()` sur ce serveur, car le test tourne dans son propre processus de worker. MSW n'a aucune API publiée pour changer les handlers d'un autre processus. La proposition, `setupRemoteServer` dans [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617), est ouverte depuis le 2023-05-12. Le binding Playwright de MSW indique qu'il s'appuie sur `page.route()` en attendant sa sortie ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- Si vous ajoutez votre propre canal, comme une route d'API qui appelle `server.use()`, le changement atteint tous les tests. La documentation de [`server.use()`](https://mswjs.io/api/setup-server/use) précise que les handlers ajoutés ainsi « persist on the server instance ». L'[article sur la server boundary](https://mswjs.io/blog/introducing-server-boundary) explique que des surcharges concurrentes sur un même serveur deviennent « a global state shared between all tests ». Dans #1617, l'auteur de MSW note qu'en pratique, soit on garde « a fixed list of handlers », soit on démarre « an app instance per test case ».

En pratique, MSW dans un serveur Next.js partagé donne les mêmes réponses à tous les tests parallèles. Deux outils ajoutent des handlers par test par-dessus MSW. Le mode test de Next.js accepte des handlers MSW (avec MSW 2, voir plus haut). [scenarist](https://github.com/citypaul/scenarist) identifie les scénarios grâce à un en-tête `x-scenarist-test-id` que le code de votre serveur transmet à chaque `fetch` ([adaptateur Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## Un proxy sortant comme mockttp {#mockttp}

Quand l'équipe Playwright a fermé #30766, elle a [renvoyé vers](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) l'[article](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) de Simon Knott. Celui-ci place [mockttp](https://github.com/httptoolkit/mockttp), un serveur de mock et proxy HTTP et HTTPS, devant le trafic sortant du serveur. Chaque test y ajoute des règles, comme `mocks.forPost(url).thenJson(200, body)`.

Le code de l'app ne change pas. Son processus serveur démarre avec des variables d'environnement qui font passer les requêtes sortantes par le proxy :

- `HTTP_PROXY` et `HTTPS_PROXY`, qui contiennent l'URL du proxy.
- `NODE_USE_ENV_PROXY=1`, pour que le `fetch` intégré de Node utilise ces variables. Node.js l'a ajoutée en 24.0.0 et 22.21.0, et la marque comme en développement actif ([documentation de Node.js](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS`, qui pointe vers le certificat d'autorité (CA) du proxy, pour que le serveur fasse confiance aux certificats que mockttp génère pour les hôtes HTTPS.

Le proxy appartient à un seul worker Playwright : l'article démarre donc un serveur d'app par worker depuis une fixture de worker, chacun sur un port libre. Il évite le `webServer` de Playwright, qui démarre un seul processus pour toute l'exécution, avant qu'aucun worker n'existe. Dans la configuration de l'article, les requêtes sans règle passent jusqu'à la vraie API. L'article suggère plutôt d'y répondre par une erreur, pour qu'un mock oublié se remarque.

L'équipe Playwright décrit l'approche comme « agnostic of the server language and framework ». L'article lui-même utilise un simple serveur Node, ni Next.js ni TanStack Start.

## Enregistrer de vraies réponses avec test-proxy-recorder {#test-proxy-recorder}

Avec les trois options ci-dessus, vous écrivez chaque réponse vous-même. test-proxy-recorder enregistre ce que renvoie votre vraie API pendant une exécution locale, puis le rejoue en CI.

- **Le proxy.** Lancez `test-proxy-recorder <target-url>` à côté de votre app pour l'exécution des tests. Pointez l'URL de base de l'API de l'app vers lui tant que `TEST_PROXY_RECORDER_ENABLED` est défini. Chaque proxy transmet à un seul backend, la `<target-url>` avec laquelle il a été lancé.
- **`registerProxyFetch()`.** Un seul appel sur le serveur patche le `fetch` global. Il recopie l'en-tête `x-test-rcrd-id` de la requête courante sur chaque requête sortante. Le proxy lit cet en-tête pour classer chaque appel côté serveur sous son test. L'appel est un no-op en production, sauf si `TEST_PROXY_RECORDER_ENABLED` est défini.
- **L'id par test.** `playwrightProxy.before(page, testInfo, mode)` construit un id de session à partir du fichier de spec et du titre du test. Il envoie cet id comme `x-test-rcrd-id` sur les requêtes de la page et passe cette session en `record` ou en `replay`. Les workers en parallèle partagent un même serveur d'app et un même proxy, et chaque test obtient tout de même son propre enregistrement.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Enregistrez une fois contre la vraie API et committez les fichiers `.mock.json` (serveur) et `.har` (navigateur). La CI les rejoue ensuite avec le backend éteint. En replay, une requête sans enregistrement reçoit une 404 qui la nomme. Elle n'atteint jamais l'API.

Les réponses enregistrées ne couvrent que ce que l'API a fait pendant l'enregistrement. Pour forcer une erreur ou un cas limite que l'API ne produit pas à la demande, un handler écrit à la main avec l'une des options ci-dessus est plus simple.

Les détails de configuration se trouvent dans les guides [Next.js](/fr/docs/integrations/nextjs/) et [TanStack Start](/fr/docs/integrations/tanstack-start/).

## Comparer les options {#comparison}

| Option | Mise en place dans l'app | Tests en parallèle | Handlers ou réponses enregistrées | Next.js et TanStack Start |
| --- | --- | --- | --- | --- |
| [Mode test de Next.js](#nextjs-test-mode) | `experimental.testProxy` dans `next.config.js` | Oui, les handlers sont conservés par test | Handlers (`next.onFetch()`, ou handlers MSW 2) | Next.js uniquement |
| [MSW dans le serveur](#msw) | `setupServer` démarré dans le code serveur (le root layout dans l'exemple de MSW) | Un seul jeu de handlers pour tous les tests de ce serveur | Handlers | Next.js : un exemple dans une pull request ouverte. TanStack Start : non documenté |
| [mockttp](#mockttp) | Aucun changement de code. Variables de proxy et certificat CA sur le processus serveur | Oui, avec un serveur d'app par worker | Handlers. Les requêtes sans règle passent | Non documenté. L'équipe Playwright le dit indépendant du framework |
| [test-proxy-recorder](#test-proxy-recorder) | URL de base de l'API pointée vers le proxy pendant les tests, plus `registerProxyFetch()` | Oui, avec un seul serveur d'app partagé | Enregistrées depuis la vraie API | Les deux documentés |

La [comparaison](/fr/docs/reference/comparison/) couvre d'autres outils, dont Mocky Balboa, scenarist, Polly.js, talkback et proxay, ainsi que les options côté navigateur.
