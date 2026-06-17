---
title: Apps d'exemple
description: Exemples complets et fonctionnels de test-proxy-recorder — SSR Next.js, une extension Chrome, un ticker WebSocket tiers et une app authentifiée rejouée sans backend.
---

Des exemples complets et fonctionnels se trouvent dans [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — un par mécanisme d'enregistrement. Chacun a son propre README avec la configuration complète et le flux enregistrer/rejouer.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — une app de tâches Next.js 16 avec un backend mock, un proxy et des tests e2e Playwright. Enregistre à la fois les fetches SSR (`.mock.json`) et les fetches navigateur (`.har`), et inclut un chat WebSocket contre le backend local. Voir son [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

## Extension Chrome {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — une vraie extension Chrome qui appelle l'API de X/Twitter depuis un content script ; les requêtes navigateur sont enregistrées en `.har` et rejouées hors ligne, sans API en direct ni compte en CI. Voir son [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

## Ticker crypto — WebSocket tiers {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — un ticker de prix BTC-USD en direct alimenté par le flux WebSocket public de Binance. Enregistre le vrai flux une fois via le proxy, puis rejoue des prix déterministes en CI sans réseau ni compte d'exchange. Voir son [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

## App authentifiée {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — une app Next.js qui se connecte à un user pool **AWS Cognito réel**, puis enregistre/rejoue son API protégée. La connexion reste en direct à chaque exécution (jamais enregistrée) ; les données protégées sont rejouées avec le backend éteint, et le jeton d'authentification est rédigé des enregistrements. L'intégration ne représente qu'une poignée de fichiers — voir son [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md). Pour le même modèle **sans compte cloud**, voir [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
