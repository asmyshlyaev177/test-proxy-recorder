---
title: Endpoint de contrôle
description: Le proxy expose /__control pour changer de mode par programme entre transparent, record et replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

Le proxy expose `/__control` pour changer de mode par programme.

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // required unless cleanup is true
  id?: string;       // required for record/replay (and for cleanup)
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

Dans la plupart des configurations, vous n'appelez pas ceci directement — `playwrightProxy.before()` et `setProxyMode()` (voir la [référence de l'API](/docs/reference/api/readme/)) y envoient un POST pour vous. Recourez à `/__control` quand vous pilotez le proxy depuis un shell, une étape de CI ou un agent IA.

## Sessions

Le proxy garde une session par id de test, en mode record comme en replay : les tests répartis sur des workers en parallèle partagent donc un seul proxy. Chaque requête va à la session nommée dans son en-tête `x-test-rcrd-id`, ou dans le cookie `proxy-recording-id` lors du handshake WebSocket d'un navigateur. Les versions jusqu'à 2.0.1 gardaient une seule session d'enregistrement pour toutes les requêtes.

- **`{"mode": "record", "id": "my-test-1"}`** démarre l'enregistrement de cette session. Les sessions déjà en cours d'enregistrement continuent.
- **`{"id": "my-test-1", "cleanup": true}`** n'agit que sur cette session. Une session de replay se ferme. Une session d'enregistrement est sauvegardée dans son `.mock.json` et continue d'enregistrer les requêtes qui la nomment jusqu'au passage en `transparent`, si bien qu'une requête tardive de ce test est sauvegardée elle aussi.
- **`{"mode": "transparent"}`** sauvegarde et termine toutes les sessions, si bien que chaque requête passe jusqu'à la cible. `playwrightProxy.teardown()` l'envoie. Le minuteur de mode fait de même quand `timeout` expire, et chaque changement de mode relance le minuteur.

Une requête qui ne nomme aucune session va à l'unique session en cours. Si plusieurs sessions tournent, le proxy y répond par une 400, en record comme en replay, et le corps liste les ids en cours dans `activeSessions`. Si aucune session ne tourne, la requête suit le dernier changement de mode.

## État courant

`GET /__control` renvoie :

- `recordingsDir`, le répertoire où les enregistrements sont écrits.
- `mode` et `id`, issus du dernier changement de mode.
- `redaction`, la configuration du [masquage](/fr/docs/guides/secret-redaction/), ou `false` quand le masquage est désactivé. `playwrightProxy.teardown()` la lit pour masquer les fichiers `.har`.
- `sessions`, les ids qui sont en cours d'enregistrement.
