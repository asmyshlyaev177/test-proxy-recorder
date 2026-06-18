---
title: Rédaction des secrets
description: La rédaction est activée par défaut — Authorization, Cookie et Set-Cookie sont retirés des enregistrements avant d'atteindre le disque. Ajoutez des motifs d'en-tête et de corps, autorisez des cookies, ou rédigez par programme.
---

Les enregistrements sont committés dans git, donc les secrets sont retirés avant d'écrire quoi que ce soit sur le disque. La rédaction est **activée par défaut** ; le proxy remplace les valeurs de ces en-têtes de requête/réponse par `[REDACTED]` :

- `Authorization`
- `Cookie`
- `Set-Cookie`

C'est sûr : la correspondance de replay ignore ces en-têtes, donc la rédaction ne casse jamais la lecture. Elle s'applique aux enregistrements `.mock.json`, aux enregistrements WebSocket et aux fichiers `.har`. Pour désactiver la rédaction, passez `--no-redact` en CLI ou définissez `redaction: false` dans la [configuration](/fr/docs/guides/config/).

Quand seuls *certains* cookies sont sensibles, autorisez les inoffensifs par nom (par exemple un cookie de `theme` ou de test A/B). Les cookies autorisés conservent leurs valeurs dans `Cookie`/`Set-Cookie` ; tout autre cookie reste rédigé.

:::note[Comment les fichiers `.har` sont rédigés]
Les fichiers `.har` sont écrits par le `routeFromHAR` de Playwright, pas par le proxy, donc ils sont rédigés lors d'une passe distincte. `playwrightProxy.teardown()` réécrit chaque `.har` du répertoire d'enregistrements en utilisant la **même configuration de rédaction** que le proxy (les en-têtes, `allowCookies` et `bodyPatterns` s'appliquent, à la fois aux en-têtes et aux tableaux `cookies` analysés). Cela s'exécute depuis votre **`globalTeardown`** Playwright — donc la rédaction des HAR nécessite un `globalTeardown` qui appelle `playwrightProxy.teardown()` (la [configuration recommandée](/fr/docs/integrations/playwright/#global-teardown-recommended), générée par `init`).

Elle ne peut pas s'exécuter par test : Playwright vide un HAR quand son contexte se ferme mais n'attend pas les handlers de fermeture, donc rédiger là entre en compétition avec la sortie du processus et peut tronquer le fichier. Le teardown récupère la configuration depuis `/__control` (le proxy doit tourner ; s'il est injoignable, les valeurs par défaut d'en-têtes intégrées s'appliquent quand même), ne réécrit que les fichiers réellement modifiés et laisse intacts les corps de réponse en base64. Par défense en profondeur, enregistrez tout de même avec des identifiants de test à courte durée et relisez les HAR avant de committer — voir le modèle d'authentification recommandé ci-dessous.
:::

## Modèle d'authentification recommandé

Pour garder le flux de connexion et les identifiants totalement hors des enregistrements, exécutez l'authentification dans un **setup project** Playwright avec le proxy en mode `transparent`, persistez le `storageState` dans un `auth-state.json` **gitignoré** et réutilisez-le dans vos tests. Les requêtes enregistrées ne portent alors que les en-têtes de session (rédigés), jamais la connexion.

Voir l'[exemple d'app authentifiée](/fr/docs/reference/examples/#authenticated-app) pour une configuration fonctionnelle contre un vrai fournisseur d'authentification.

## Ajuster ce qui est rédigé

Les en-têtes par défaut s'appliquent toujours (tant que la rédaction est activée) ; vous pouvez en ajouter.

### Flags de CLI

- `--no-redact` — désactive la rédaction des secrets (activée par défaut).
- `--redact` — active la rédaction des secrets ; nécessaire seulement pour la réactiver quand la configuration met `redaction: false`.
- `--redact-headers <names>` — noms d'en-têtes supplémentaires à rédiger, séparés par des virgules (fusionnés avec les valeurs par défaut).
- `--redact-body <patterns>` — motifs regex séparés par des virgules à rédiger des corps de requête/réponse.
- `--allow-headers <names>` — noms d'en-têtes séparés par des virgules à exempter de la rédaction (par exemple `set-cookie`).
- `--allow-cookies <names>` — noms de cookies séparés par des virgules à garder non rédigés dans `Cookie`/`Set-Cookie`.

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Par programme

En construisant `ProxyServer` directement :

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

`redactSession(session, config)` est aussi exporté si vous voulez rédiger vous-même des enregistrements existants.
