---
title: Endpoint de contrôle
description: Le proxy expose /__control pour changer de mode par programme entre transparent, record et replay.
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
  mode: 'transparent' | 'record' | 'replay';
  id?: string;       // required for record/replay
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
}
```

Dans la plupart des configurations, vous n'appelez pas ceci directement — `playwrightProxy.before()` et `setProxyMode()` (voir la [référence de l'API](/docs/reference/api/readme/)) y envoient un POST pour vous. Recourez à `/__control` quand vous pilotez le proxy depuis un shell, une étape de CI ou un agent IA.
