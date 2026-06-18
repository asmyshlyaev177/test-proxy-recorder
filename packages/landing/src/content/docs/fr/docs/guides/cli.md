---
title: CLI
description: L'interface en ligne de commande de test-proxy-recorder — options, cadence de replay WebSocket et comment réinitialiser un proxy bloqué.
---

```bash
test-proxy-recorder <target-url> [options]
```

| Option           | Défaut         | Description                         |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(requis)*     | URL du backend à proxifier          |
| `--port, -p`     | `8000`         | Port d'écoute du proxy              |
| `--dir, -d`      | `./recordings` | Répertoire des fichiers d'enregistrement |
| `--timeout, -t`  | `120000`       | Timeout de réinitialisation auto de session (ms) |
| `--config, -c`   | *(auto)*       | Chemin vers un fichier de configuration |
| `--ws-timing`    | `burst`        | Cadence de replay WebSocket — `burst` ou `original` |

La rédaction des secrets est **activée par défaut** — Authorization/Cookie/Set-Cookie sont retirés des enregistrements automatiquement. Désactivez-la avec `--no-redact`, ou `redaction: false` dans la [configuration](/fr/docs/guides/config/). Voir [rédaction des secrets](/fr/docs/guides/secret-redaction/) pour les flags `--redact-headers` et `--redact-body` qui ajoutent à ce qui est rédigé.

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## Cadence de replay WebSocket

Par défaut, les messages serveur WebSocket enregistrés sont rejoués en **rafale** (`burst`) à la connexion — le plus rapide et totalement déterministe, idéal pour la CI. Passez `--ws-timing original` (ou `websocket: { timing: 'original' }` dans la configuration) pour les rejouer selon les horodatages enregistrés, afin que les messages arrivent avec leurs intervalles réels ; un test dure alors à peu près le temps réel de l'enregistrement.

Vous pouvez aussi définir cela **par test** via `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, qui remplace la valeur par défaut du proxy pour cette session uniquement.

## Réinitialiser un proxy bloqué

Le proxy revient automatiquement à `transparent` après le timeout de chaque session, et le `globalTeardown` le réinitialise à la fin d'une exécution propre. Mais une exécution **interrompue** (`Ctrl+C`), une session UI/débogage, ou une configuration sans `globalTeardown` peuvent laisser le proxy partagé bloqué en `record`/`replay` — de sorte que votre app continue de servir des réponses enregistrées au lieu d'appeler le vrai backend. Réinitialisez-le à la demande :

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

Cela envoie un POST `{ "mode": "transparent" }` à `/__control` — le remplacement pris en charge et compatible parallèle de la réinitialisation manuelle avec `curl`. C'est sûr à tout moment : un proxy injoignable est traité comme un no-op. Le port est résolu ainsi : **flag `--port` → env `TEST_PROXY_RECORDER_PORT` → fichier de configuration → `8000`**, donc il cible le port sur lequel le proxy a été démarré (passez `--port` / `--config` pour remplacer). `init` le génère comme le script `proxy:reset`.

## `init` — générer la configuration

Voir le [démarrage rapide](/fr/docs/getting-started/quick-start/) pour la configuration recommandée en une seule commande avec `npx test-proxy-recorder init`.
