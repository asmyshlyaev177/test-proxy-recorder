---
title: Fichier de configuration
description: Placez les options de test-proxy-recorder — cible, port, regex de rédaction, cadence WebSocket — dans un fichier de configuration auto-détecté plutôt que dans des flags de CLI.
---

Pour tout ce qui va au-delà de quelques flags — en particulier les regex de rédaction de corps — placez les options dans un fichier de configuration. Le proxy auto-détecte `test-proxy-recorder.config.{ts,js,mjs,cjs}` dans le répertoire courant, ou passez `--config <path>` pour en pointer un explicitement. Les fichiers `.ts` fonctionnent tels quels.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // Redaction is on by default; this object customizes it (use `redaction: false` to disable).
  redaction: {
    headers: ['x-api-key'],         // extra headers, merged with the defaults
    bodyPatterns: [/sk_live_\w+/g], // real RegExp literals — no CLI escaping
    allowCookies: ['theme'],        // keep these cookies unredacted
  },
  websocket: {
    timing: 'burst',                // 'burst' (default) or 'original' (re-paced)
  },
});
```

```bash
test-proxy-recorder                 # all options from the config file
test-proxy-recorder --port 9000     # config file, but CLI port wins
```

## Priorité

Chaque option se résout ainsi : **flag de CLI → fichier de configuration → valeur par défaut intégrée**. Un flag passé en ligne de commande remplace toujours le fichier de configuration ; ce que vous omettez revient à la configuration, puis à la valeur par défaut. (Les flags de liste comme `--redact-headers` *remplacent* la liste de la configuration au lieu de la fusionner — ne le passez que quand vous voulez remplacer.) `target` peut être donné comme argument de la CLI ou comme `target` dans la configuration ; l'argument l'emporte quand les deux sont présents.

Voir la [référence de l'API](/docs/reference/api/interfaces/config/) pour le type `Config` complet.
