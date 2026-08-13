<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · Français · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=fr source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **VCR pour Playwright** — enregistrez une fois les vraies réponses d'API, rejouez-les de façon déterministe en CI. Couvre le SSR Next.js & TanStack Start, le trafic navigateur et WebSocket. Sans backend, sans mocks écrits à la main.

[![Étoiles GitHub](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![licence](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Disponible pour mission](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Enregistrement des vraies réponses d'API, puis rejeu en CI avec le backend éteint" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## Pourquoi

Chaque exécution e2e flaky a la même cause racine : le réseau. Ceci enregistre une fois le trafic réel, puis le rejoue octet par octet en CI — afin que les tests passent avec le backend éteint.

- **Pas de backend en CI** — rejeu depuis le disque, sans réseau.
- **Pas de mocks manuels** — capturez les interactions réelles, n'écrivez jamais de fixtures à la main.
- **SSR + navigateur + WebSocket** — enregistrez partout où les requêtes ont leur origine.

## Comparaison

test-proxy-recorder est celui qui enregistre du trafic **réel** à travers le SSR, le navigateur et les WebSockets sans mocks écrits à la main — cette combinaison est le vide que les autres laissent ouvert.

| Fonctionnalité | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Enregistre le trafic réel | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Côté serveur (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Côté navigateur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Natif Playwright | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Maintenu | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js intercepte le HTTP de Node, donc le mock SSR est possible dans le processus de l'app, mais pas dans le cadre d'une exécution Playwright. MSW et Mocky Balboa rejouent aussi de vraies réponses — mais vous écrivez les mocks à la main au lieu de les enregistrer.

Voir la [comparaison complète dans les docs](https://test-proxy-recorder.dev/docs/#comparison) — y compris quand choisir autre chose.

## Démarrage rapide

**Chemin le plus rapide — confiez-le à votre agent de codage IA.** Copiez ceci, remplacez votre URL de backend et collez-le dans Claude Code / Cursor / etc. (il exécute `init` et termine le branchement) :

```text
# Configurez test-proxy-recorder pour les tests de bout en bout dans ce projet, puis suivez les instructions qu'affiche `init`. Exécutez ces commandes :
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# Complétez ensuite les étapes qu'affiche init : pointez l'URL de base de l'API de l'app vers le proxy en dev/test uniquement, taggez les fetches côté serveur (Next.js), ajoutez un smoke test et vérifiez enregistrer → rejouer.
```

Vous préférez le brancher à la main :

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` scaffolde tout sans rien écraser : la config du proxy, une fixture Playwright, un teardown global, des scripts `package.json`, et (sur Next.js) branche le marquage des fetches SSR dans votre root layout via `registerProxyFetch()`. Il termine en affichant un prompt d'agent IA sur mesure pour les étapes spécifiques à l'app qu'il ne peut pas deviner.

La seule chose que `init` ne peut pas deviner est quelle variable d'environnement contient l'URL de base de votre API. Pointez-la vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production :

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // adresse du proxy issue de `init`
```

Définissez ensuite `MODE = 'record'`, exécutez une fois contre la vraie API, basculez sur `'replay'` et committez `e2e/recordings/`. La CI tourne désormais avec le backend éteint.

Guide complet : [démarrage rapide](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [configuration manuelle](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **Ça vient de vous épargner un après-midi d'écriture de mocks à la main ?**
> Une [⭐ sur GitHub](https://github.com/asmyshlyaev177/test-proxy-recorder) prend une seconde et c'est ainsi que la prochaine personne qui lutte contre des tests e2e flaky trouve ceci. Je suis mainteneur solo et je lis chaque étoile comme un signal pour continuer.

## Exemples

Des apps complètes et fonctionnelles dans [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), chacune avec son propre README :

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + navigateur + chat WebSocket
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — `registerProxyFetch` pour le rejeu concurrent
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + navigateur, TanStack Query, ISR, WebSocket, et une vraie connexion Cognito
- [Extension Chrome](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — navigateur uniquement, rejouée hors ligne
- [Ticker crypto](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — flux WebSocket tiers
- [App authentifiée](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — vraie connexion Cognito, API protégée rejouée

## Docs

Tout le reste se trouve sur [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/) : [comment ça marche](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [config](https://test-proxy-recorder.dev/docs/guides/config/), [masquage des secrets](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [intégration Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [intégration TanStack Start](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [référence API](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

Vous utilisez un agent de codage IA ? `npx @tanstack/intent@latest install` ajoute des skills afin qu'il génère le bon code de configuration. Voir le [guide des skills pour agents IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Prérequis

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (peer dependency)

## Retours et contributions

Ceci est construit et maintenu en open source par une seule personne, et chaque retour oriente ce qui est construit ensuite :

- **[⭐ Mettez une étoile au repo](https://github.com/asmyshlyaev177/test-proxy-recorder)** — le moyen le plus rapide de le soutenir, et cela aide réellement les autres à le découvrir.
- **Vous êtes tombé sur une difficulté ou vous avez une idée ?** [Ouvrez une issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) ou dites bonjour sur [Discord](https://discord.gg/w7rgYbY5zz) — même un simple « ça m'a embrouillé » vaut de l'or.
- **Vous voulez contribuer ?** Les PR sont les bienvenues.

## Skill IA

Vous utilisez un agent de codage IA (Claude Code, Cursor, Copilot, …) ? La bibliothèque fournit les skills [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) afin que l'agent génère le bon code de configuration. Installez le paquet, puis écrivez le guide de l'agent :

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` ajoute le guide de découverte des skills à la config de votre agent (`CLAUDE.md`, `.cursorrules`, …) ; l'agent charge les skills `proxy-setup`, `nextjs-ssr` et `tanstack-start` à la demande. Listez-les ou chargez-les directement avec `npx @tanstack/intent@latest list` et `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`. Guide complet : [skills pour agents IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

Les sources des skills se trouvent dans [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/).

## Recrutez-moi

Je suis **Aleksandr Smyshliaev** — auteur et mainteneur de cet outil. Ingénieur
frontend senior (React / Next.js / TypeScript, 8+ ans), et **disponible pour du
travail à distance à temps plein dès maintenant**.

Ce projet existe parce que j'ai passé des années à réparer les suites de tests
flaky des autres. C'est le type de travail où je suis le meilleur : l'infrastructure
ennuyeuse qui détermine si une base de code reste agréable six mois plus tard.

- **Le meilleur en** — bibliothèques de composants, gestion d'état et suites de
  tests qui survivent à un refactor.
- **Aussi à moi** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (~84k installs hebdomadaires),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (état d'URL
  typé), [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **Où** — Tbilissi, Géorgie (GMT+4), chevauchement complet avec le CET. Entité
  de contractor enregistrée, donc un engagement B2B ne nécessite aucune
  configuration employer of record.
- **Me joindre** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## Licence

MIT
