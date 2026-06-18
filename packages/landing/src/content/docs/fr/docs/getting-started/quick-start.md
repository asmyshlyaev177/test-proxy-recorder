---
title: Démarrage rapide
description: Intégrez test-proxy-recorder dans un projet avec une seule commande init, puis enregistrez une fois et rejouez en CI.
---

Installez :

```bash
npm install --save-dev test-proxy-recorder
```

## Le plus rapide : générer avec `init`

Une seule commande intègre test-proxy-recorder dans un projet :

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

Tous les arguments sont optionnels et reviennent à des valeurs par défaut raisonnables (`http://localhost:3000`, port `8100`, `./e2e/recordings`). Il génère et modifie les fichiers de façon **non destructive** — les fichiers et scripts existants ne sont jamais écrasés sauf si vous passez `--force`.

### Ce que `init` génère et modifie

- `test-proxy-recorder.config.ts` — la configuration du proxy (auto-détectée, donc `npx test-proxy-recorder` n'a ensuite besoin d'aucun flag).
- `playwright.config.ts` — ajoute un `webServer` pointant vers l'endpoint `/__control` du proxy ainsi qu'un `globalTeardown`. Une configuration Playwright existante est **modifiée sur place** ; si vous n'avez pas Playwright du tout, `init` lance d'abord la CLI Playwright pour le configurer (passez `--no-install` pour l'ignorer).
- `e2e/fixtures.ts` et `e2e/global-teardown.ts` — la fixture de proxy par test et le teardown.
- `package.json` — ajoute les scripts `proxy`, `proxy:reset`, `test:e2e` et `test:e2e:record`. Si vous avez un script `dev`, il est enveloppé : l'original devient `dev:app` et `dev` devient une commande `concurrently` qui lance le proxy à côté de votre app (ainsi `npm run dev` enregistre pendant que vous développez). `concurrently` est ajouté aux `devDependencies`.

Une configuration Playwright qui définit déjà un `webServer` est laissée intacte, avec une note sur ce qu'il faut ajouter.

## La seule étape manuelle

La **seule étape que `init` ne peut pas faire à votre place** est de router les appels backend de votre app à travers le proxy — quelle variable d'environnement contient l'URL de base de votre API, et comment vous la limitez au dev, dépend de l'app. `init` affiche des instructions concrètes pour cela à la fin : pointez cette variable d'environnement vers `http://localhost:8100` **en dev/test uniquement, jamais en production** (par exemple, préfixez le script `dev:app`, en utilisant `cross-env` sous Windows). Le proxy transmet alors à votre vrai backend tout en enregistrant, et sert les enregistrements lors du replay.

Ensuite, écrivez un test, enregistrez une fois contre la vraie API, passez en replay et committez `e2e/recordings/`. La [configuration manuelle](/fr/docs/getting-started/manual-setup/) montre cette boucle en entier.
